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
