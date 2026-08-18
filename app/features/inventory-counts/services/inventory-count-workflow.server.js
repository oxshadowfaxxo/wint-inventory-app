import prisma from "../../../db.server";

export class InventoryCountWorkflowError extends Error {
  constructor(message, code = "INVALID_TRANSITION") {
    super(message);
    this.name = "InventoryCountWorkflowError";
    this.code = code;
  }
}

const transitionTargets = {
  continue: { from: ["DRAFT", "REVIEW"], to: "COUNTING" },
  save: { from: ["COUNTING"], to: "DRAFT" },
  complete: { from: ["REVIEW"], to: "COMPLETED" },
};

export async function transitionInventoryCount({ shop, countId, transition }) {
  const rule = transitionTargets[transition];
  if (!rule) throw new InventoryCountWorkflowError("Unknown inventory count action.");

  const result = await prisma.inventoryCount.updateMany({
    where: { id: countId, shop, status: { in: rule.from } },
    data: {
      status: rule.to,
      ...(rule.to === "COMPLETED" ? { completedAt: new Date() } : {}),
    },
  });
  if (result.count !== 1) {
    throw new InventoryCountWorkflowError(
      "This count is no longer in a status that allows that action.",
    );
  }
}

const neverCountedWhere = {
  committedUncounted: false,
  countedQuantity: 0,
  firstScannedAt: null,
  status: "UNCOUNTED",
};

export async function getUncountedSummary(shop, countId) {
  const count = await prisma.inventoryCount.findFirst({
    where: { id: countId, shop, status: "COUNTING" },
    select: {
      lines: {
        where: neverCountedWhere,
        select: { startingQuantity: true },
      },
    },
  });
  if (!count) {
    throw new InventoryCountWorkflowError(
      "This count is no longer in counting mode.",
    );
  }
  return {
    variants: count.lines.length,
    expectedQuantity: count.lines.reduce(
      (sum, line) => sum + (line.startingQuantity ?? 0),
      0,
    ),
  };
}

export async function finishInventoryCount({ shop, countId, commitUncounted }) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId, shop, status: "COUNTING" },
      select: {
        lines: {
          where: neverCountedWhere,
          select: { id: true, startingQuantity: true },
        },
      },
    });
    if (!count) {
      throw new InventoryCountWorkflowError(
        "This count is no longer in counting mode.",
      );
    }
    const summary = {
      variants: count.lines.length,
      expectedQuantity: count.lines.reduce(
        (sum, line) => sum + (line.startingQuantity ?? 0),
        0,
      ),
    };
    if (summary.variants > 0 && !commitUncounted) return summary;

    if (summary.variants > 0) {
      await tx.inventoryCountLine.updateMany({
        where: {
          inventoryCountId: countId,
          id: { in: count.lines.map((line) => line.id) },
          ...neverCountedWhere,
        },
        data: { committedUncounted: true },
      });
    }
    const updated = await tx.inventoryCount.updateMany({
      where: { id: countId, shop, status: "COUNTING" },
      data: { status: "REVIEW" },
    });
    if (updated.count !== 1) {
      throw new InventoryCountWorkflowError(
        "This count is no longer in counting mode.",
      );
    }
    return null;
  });
}

export function friendlyWorkflowError(error) {
  if (error instanceof InventoryCountWorkflowError) return error.message;
  console.error("Inventory count workflow failed", {
    code: error.code,
    message: error.message,
    stack: error.stack,
  });
  return "The inventory count could not be updated. Please try again.";
}

async function incrementScannedLine({ shop, countId, lineId }) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.inventoryCountLine.findFirst({
      where: {
        id: lineId,
        inventoryCountId: countId,
        inventoryCount: { shop, status: "COUNTING" },
      },
      select: { id: true, productTitle: true, variantTitle: true, firstScannedAt: true },
    });
    if (!line) {
      throw new InventoryCountWorkflowError("This count is not currently in counting mode.");
    }
    const now = new Date();
    return tx.inventoryCountLine.update({
      where: { id: line.id },
      data: {
        countedQuantity: { increment: 1 },
        firstScannedAt: line.firstScannedAt ?? now,
        lastScannedAt: now,
        status: "COUNTED",
        committedUncounted: false,
      },
      select: { id: true, productTitle: true, variantTitle: true, countedQuantity: true },
    });
  });
}

export async function scanInventoryCountBarcode({ shop, countId, barcode, findShopifyVariant }) {
  const trimmedBarcode = String(barcode ?? "").trim();
  if (!trimmedBarcode) {
    throw new InventoryCountWorkflowError("Scan or enter a barcode.", "BARCODE_REQUIRED");
  }

  const count = await prisma.inventoryCount.findFirst({
      where: { id: countId, shop },
      select: { id: true, status: true, countType: true },
    });
  if (!count || count.status !== "COUNTING") {
      throw new InventoryCountWorkflowError(
        count ? "This count is not currently in counting mode." : "Inventory count not found.",
      );
  }
  const matches = await prisma.inventoryCountLine.findMany({
      where: { inventoryCountId: count.id, barcode: trimmedBarcode },
      select: { id: true, productTitle: true, variantTitle: true, firstScannedAt: true },
    });
  if (matches.length > 1) {
    return {
      duplicate: true,
      barcode: trimmedBarcode,
      message: `Multiple products in this count use barcode ${trimmedBarcode}.`,
      // firstScannedAt is intentionally omitted from duplicate-match responses.
      // eslint-disable-next-line no-unused-vars
      matchingProducts: matches.map(({ firstScannedAt: _firstScannedAt, ...line }) => line),
    };
  }
  if (matches.length === 1) {
    const line = await incrementScannedLine({ shop, countId, lineId: matches[0].id });
    return { line, barcode: trimmedBarcode };
  }
  if (count.countType !== "BLANK_SCAN") {
      throw new InventoryCountWorkflowError("Barcode not found in this count.", "BARCODE_NOT_FOUND");
  }
  const variant = await findShopifyVariant(trimmedBarcode);
  try {
    const now = new Date();
    const line = await prisma.$transaction(async (tx) => {
      const currentCount = await tx.inventoryCount.findFirst({
        where: { id: countId, shop, status: "COUNTING", countType: "BLANK_SCAN" },
        select: { id: true },
      });
      if (!currentCount) {
        throw new InventoryCountWorkflowError("This count is not currently in counting mode.");
      }
      return tx.inventoryCountLine.create({
        data: {
          inventoryCountId: countId,
          ...variant,
          countedQuantity: 1,
          status: "COUNTED",
          firstScannedAt: now,
          lastScannedAt: now,
          committedUncounted: false,
        },
        select: { id: true, productTitle: true, variantTitle: true, countedQuantity: true },
      });
    });
    return { line, barcode: trimmedBarcode };
  } catch (error) {
    if (error.code !== "P2002") throw error;
    const racedLine = await prisma.inventoryCountLine.findUnique({
      where: {
        inventoryCountId_inventoryItemId: {
          inventoryCountId: countId,
          inventoryItemId: variant.inventoryItemId,
        },
      },
      select: { id: true },
    });
    if (!racedLine) throw error;
    const line = await incrementScannedLine({ shop, countId, lineId: racedLine.id });
    return { line, barcode: trimmedBarcode };
  }
}

const MAX_COUNTED_QUANTITY = 2147483647;

function parseQuantity(value) {
  const text = String(value ?? "");
  if (!/^\d+$/.test(text)) {
    throw new InventoryCountWorkflowError(
      "Enter a whole-number quantity of 0 or greater.",
      "INVALID_QUANTITY",
    );
  }
  const quantity = Number(text);
  if (!Number.isSafeInteger(quantity) || quantity > MAX_COUNTED_QUANTITY) {
    throw new InventoryCountWorkflowError(
      "Enter a whole-number quantity of 0 or greater.",
      "INVALID_QUANTITY",
    );
  }
  return quantity;
}

export async function updateInventoryLineQuantity({
  shop,
  countId,
  lineId,
  intent,
  submittedQuantity,
}) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.inventoryCountLine.findFirst({
      where: {
        id: lineId,
        inventoryCountId: countId,
        inventoryCount: { shop, status: "COUNTING" },
      },
      select: { id: true, countedQuantity: true, firstScannedAt: true },
    });
    if (!line) {
      const count = await tx.inventoryCount.findFirst({
        where: { id: countId, shop },
        select: { status: true },
      });
      throw new InventoryCountWorkflowError(
        count && count.status !== "COUNTING"
          ? "This count is not in counting mode."
          : "Inventory line not found.",
      );
    }

    let quantity;
    if (intent === "increment-line") {
      if (line.countedQuantity >= MAX_COUNTED_QUANTITY) {
        throw new InventoryCountWorkflowError(
          "Enter a whole-number quantity of 0 or greater.",
        );
      }
      quantity = line.countedQuantity + 1;
    } else if (intent === "decrement-line") {
      quantity = Math.max(0, line.countedQuantity - 1);
    } else if (intent === "set-line-quantity") {
      quantity = parseQuantity(submittedQuantity);
    } else {
      throw new InventoryCountWorkflowError("Unknown quantity action.");
    }

    const now = new Date();
    return tx.inventoryCountLine.update({
      where: { id: line.id },
      data: {
        countedQuantity: quantity,
        firstScannedAt: line.firstScannedAt ?? now,
        lastScannedAt: now,
        status: "COUNTED",
        committedUncounted: false,
      },
      select: { id: true, countedQuantity: true },
    });
  }, { isolationLevel: "Serializable" });
}

export async function addProductToInventoryCount({ shop, countId, variant }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const count = await tx.inventoryCount.findFirst({
        where: { id: countId, shop, status: "COUNTING" },
        select: { id: true },
      });
      if (!count) {
        throw new InventoryCountWorkflowError(
          "This count is not in counting mode.",
        );
      }
      const duplicate = await tx.inventoryCountLine.findUnique({
        where: {
          inventoryCountId_inventoryItemId: {
            inventoryCountId: countId,
            inventoryItemId: variant.inventoryItemId,
          },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new InventoryCountWorkflowError(
          "This product is already in the count.",
          "DUPLICATE_VARIANT",
        );
      }
      return tx.inventoryCountLine.create({
        data: {
          inventoryCountId: countId,
          ...variant,
          countedQuantity: 0,
          status: "UNCOUNTED",
          firstScannedAt: null,
          lastScannedAt: null,
          committedUncounted: false,
        },
        select: { id: true },
      });
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new InventoryCountWorkflowError(
        "This product is already in the count.",
        "DUPLICATE_VARIANT",
      );
    }
    throw error;
  }
}

export async function removeInventoryCountLines({ shop, countId, lineIds }) {
  const selectedIds = [...new Set(lineIds.filter(Boolean))];
  if (selectedIds.length === 0) {
    throw new InventoryCountWorkflowError(
      "Select at least one product to remove.",
      "EMPTY_SELECTION",
    );
  }

  return prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId, shop },
      select: {
        status: true,
        countType: true,
        _count: { select: { lines: true } },
        lines: {
          where: { id: { in: selectedIds } },
          select: { id: true },
        },
      },
    });
    if (!count || count.status !== "COUNTING") {
      throw new InventoryCountWorkflowError(
        "This count is not in counting mode.",
      );
    }
    if (count.lines.length !== selectedIds.length) {
      throw new InventoryCountWorkflowError(
        "One or more selected products were not found in this count.",
      );
    }
    if (
      count.countType === "PRODUCT_TYPE" &&
      selectedIds.length >= count._count.lines
    ) {
      throw new InventoryCountWorkflowError(
        "An inventory count must contain at least one product.",
      );
    }
    const result = await tx.inventoryCountLine.deleteMany({
      where: { inventoryCountId: countId, id: { in: selectedIds } },
    });
    if (result.count !== selectedIds.length) {
      throw new InventoryCountWorkflowError(
        "The selected products could not be removed.",
      );
    }
    return result.count;
  }, { isolationLevel: "Serializable" });
}

export async function setInventoryCountArchived({ shop, countId, archived }) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: { id: countId, shop },
      select: { archivedAt: true },
    });
    if (!count) {
      throw new InventoryCountWorkflowError("Inventory count not found.");
    }
    if (archived) {
      if (count.archivedAt) {
        throw new InventoryCountWorkflowError("This count is already archived.");
      }
    } else if (!count.archivedAt) {
      throw new InventoryCountWorkflowError("This count is not archived.");
    }

    const result = await tx.inventoryCount.updateMany({
      where: {
        id: countId,
        shop,
        ...(archived ? { archivedAt: null } : { archivedAt: { not: null } }),
      },
      data: { archivedAt: archived ? new Date() : null },
    });
    if (result.count !== 1) {
      throw new InventoryCountWorkflowError(
        "The inventory count archive state could not be updated.",
      );
    }
  });
}
