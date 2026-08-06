import prisma from "../../../db.server";

const countSelect = {
  id: true,
  countNumber: true,
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
      committedUncounted: true,
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
      countNumber: true,
      name: true,
      status: true,
      locationName: true,
      area: true,
      productTypes: true,
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
          committedUncounted: true,
          firstScannedAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function findOverlappingCounts({
  shop,
  locationId,
  area,
  productTypes,
}) {
  const candidates = await prisma.inventoryCount.findMany({
    where: {
      shop,
      locationId,
      status: { in: ["DRAFT", "COUNTING", "REVIEW"] },
    },
    select: { id: true, name: true, area: true, productTypes: true },
  });
  const normalizedArea = area.trim().toLocaleLowerCase();
  const selected = new Set(productTypes);
  return candidates.filter((count) => {
    if (count.area.trim().toLocaleLowerCase() !== normalizedArea) return false;
    const existing = Array.isArray(count.productTypes) ? count.productTypes : [];
    return (
      existing.includes("__ALL__") ||
      selected.has("__ALL__") ||
      existing.some((type) => selected.has(type))
    );
  });
}

function formatCountName(countNumber) {
  return `Count: ${String(countNumber).padStart(3, "0")}`;
}

export async function createInventoryCount({ shop, configuration, lines }) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const latest = await tx.inventoryCount.aggregate({
            where: { shop },
            _max: { countNumber: true },
          });
          const countNumber = (latest._max.countNumber || 0) + 1;
          return tx.inventoryCount.create({
            data: {
              shop,
              countNumber,
              name: formatCountName(countNumber),
              locationId: configuration.locationId,
              locationName: configuration.locationName,
              area: configuration.area,
              productTypes: configuration.productTypes,
              status: "COUNTING",
              createdBy: configuration.employee,
              startedAt: new Date(),
              completedAt: null,
              notes: null,
              lines: { create: lines },
            },
            select: { id: true },
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if ((error.code === "P2002" || error.code === "P2034") && attempt < 4) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unable to allocate an inventory count number.");
}
