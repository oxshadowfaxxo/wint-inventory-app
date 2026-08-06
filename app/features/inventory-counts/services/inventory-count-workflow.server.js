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

export async function cancelInventoryCount({ shop, countId, reason }) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new InventoryCountWorkflowError(
      "Enter a cancellation reason.",
      "CANCELLATION_REASON_REQUIRED",
    );
  }
  return prisma.$transaction(async (tx) => {
    const count = await tx.inventoryCount.findFirst({
      where: {
        id: countId,
        shop,
        status: { in: ["DRAFT", "COUNTING", "REVIEW"] },
      },
      select: { notes: true },
    });
    if (!count) {
      throw new InventoryCountWorkflowError(
        "This count can no longer be cancelled.",
      );
    }
    const cancellationNote = `Cancellation reason:\n${trimmedReason}`;
    const notes = count.notes?.trim()
      ? `${count.notes.trim()}\n\n${cancellationNote}`
      : cancellationNote;
    const updated = await tx.inventoryCount.updateMany({
      where: {
        id: countId,
        shop,
        status: { in: ["DRAFT", "COUNTING", "REVIEW"] },
      },
      data: { status: "CANCELLED", completedAt: new Date(), notes },
    });
    if (updated.count !== 1) {
      throw new InventoryCountWorkflowError(
        "This count can no longer be cancelled.",
      );
    }
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
    if (selectedIds.length >= count._count.lines) {
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
      select: { status: true, archivedAt: true },
    });
    if (!count) {
      throw new InventoryCountWorkflowError("Inventory count not found.");
    }
    if (archived) {
      if (count.archivedAt) {
        throw new InventoryCountWorkflowError("This count is already archived.");
      }
      if (!["COMPLETED", "CANCELLED"].includes(count.status)) {
        throw new InventoryCountWorkflowError(
          "Only completed or cancelled counts can be archived.",
        );
      }
    } else if (!count.archivedAt) {
      throw new InventoryCountWorkflowError("This count is not archived.");
    }

    const result = await tx.inventoryCount.updateMany({
      where: {
        id: countId,
        shop,
        ...(archived
          ? { archivedAt: null, status: { in: ["COMPLETED", "CANCELLED"] } }
          : { archivedAt: { not: null } }),
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
