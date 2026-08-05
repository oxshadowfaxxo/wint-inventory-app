import prisma from "../../../db.server";

const countSelect = {
  id: true,
  name: true,
  locationName: true,
  status: true,
  createdBy: true,
  startedAt: true,
  completedAt: true,
  updatedAt: true,
  lines: {
    select: {
      startingQuantity: true,
      countedQuantity: true,
      status: true,
      firstScannedAt: true,
      lastScannedAt: true,
    },
  },
  scanEvents: {
    select: { scannedAt: true },
    orderBy: { scannedAt: "desc" },
    take: 1,
  },
};

export async function getInventoryCounts(shop) {
  const [currentCounts, historyCounts] = await Promise.all([
    prisma.inventoryCount.findMany({
      where: {
        shop,
        status: { in: ["DRAFT", "COUNTING", "REVIEW"] },
      },
      orderBy: [{ updatedAt: "desc" }, { startedAt: "desc" }],
      select: countSelect,
    }),
    prisma.inventoryCount.findMany({
      where: {
        shop,
        status: { in: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
      select: countSelect,
    }),
  ]);

  return { currentCounts, historyCounts };
}

export async function getInventoryCount(shop, countId) {
  return prisma.inventoryCount.findFirst({
    where: {
      id: countId,
      shop,
    },
    select: {
      id: true,
      name: true,
      status: true,
      locationName: true,
      createdBy: true,
      startedAt: true,
      completedAt: true,
      notes: true,
      lines: {
        select: {
          id: true,
          productTitle: true,
          variantTitle: true,
          sku: true,
          barcode: true,
          startingQuantity: true,
          countedQuantity: true,
          status: true,
          firstScannedAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
