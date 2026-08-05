import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TEST_SHOP = "winterthur-test.myshopify.com";
const TEST_DEVICE_ID = "TEST-SCANNER-01";

function hoursAgo(hours, minutes = 0) {
  return new Date(Date.now() - (hours * 60 + minutes) * 60 * 1000);
}

const counts = [
  {
    countNumber: "001",
    name: "[TEST] Count: 001",
    locationId: "test-location-museum-store",
    locationName: "Museum Store",
    status: "COUNTING",
    createdBy: "Bryan",
    startedAt: hoursAgo(6),
    updatedAt: hoursAgo(0, 18),
    notes: "Development count with a mix of scanned and unscanned variants.",
    lines: [
      {
        productTitle: "Glass Snowflake Ornament",
        variantTitle: "Blue",
        vendor: "Museum Artisans",
        productType: "Ornaments",
        sku: "ORN-SNOW-BLU",
        barcode: "810000100011",
        startingQuantity: 20,
        countedQuantity: 12,
      },
      {
        productTitle: "Museum Facade Mug",
        variantTitle: "12 oz",
        vendor: "Gallery Ceramics",
        productType: "Mugs",
        sku: "MUG-FACADE-12",
        barcode: "810000100028",
        startingQuantity: 15,
        countedQuantity: 8,
      },
      {
        productTitle: "Treasures of the Collection",
        variantTitle: "Hardcover",
        vendor: "Museum Press",
        productType: "Books",
        sku: "BOOK-TREAS-HC",
        barcode: "9781940001003",
        startingQuantity: 18,
        countedQuantity: 5,
      },
      {
        productTitle: "Art Deco Pendant",
        variantTitle: "Silver",
        vendor: "Heritage Jewelry",
        productType: "Jewelry",
        sku: "JEW-DECO-SLV",
        barcode: "810000100035",
        startingQuantity: 12,
        countedQuantity: 4,
      },
      {
        productTitle: "Masterpieces Puzzle",
        variantTitle: "1000 pieces",
        vendor: "Gallery Games",
        productType: "Puzzles",
        sku: "PUZ-MASTER-1000",
        barcode: "810000100042",
        startingQuantity: 10,
        countedQuantity: 3,
      },
      {
        productTitle: "Exhibition Poster Tote Bag",
        variantTitle: "Natural Canvas",
        vendor: "Museum Textiles",
        productType: "Tote Bags",
        sku: "TOTE-POSTER-NAT",
        barcode: "810000100059",
        startingQuantity: 0,
        countedQuantity: 2,
      },
      {
        productTitle: "Gallery Wing Magnet",
        variantTitle: null,
        vendor: "Museum Souvenirs",
        productType: "Magnets",
        sku: "MAG-GALLERY",
        barcode: "810000100066",
        startingQuantity: 14,
        countedQuantity: 0,
      },
      {
        productTitle: "Watercolor Notecard Set",
        variantTitle: "Set of 8",
        vendor: "Museum Paper Goods",
        productType: "Stationery",
        sku: "STAT-WATERCOLOR-8",
        barcode: "810000100073",
        startingQuantity: 9,
        countedQuantity: 0,
      },
      {
        productTitle: "Sculpture Garden Journal",
        variantTitle: "Lined",
        vendor: "Museum Paper Goods",
        productType: "Stationery",
        sku: "STAT-GARDEN-JRN",
        barcode: "810000100080",
        startingQuantity: 13,
        countedQuantity: 0,
      },
      {
        productTitle: "Collection Highlights Magnet Set",
        variantTitle: "Set of 4",
        vendor: "Museum Souvenirs",
        productType: "Magnets",
        sku: "MAG-HIGHLIGHT-4",
        barcode: "810000100097",
        startingQuantity: 12,
        countedQuantity: 0,
      },
    ],
  },
  {
    countNumber: "002",
    name: "[TEST] Count: 002",
    locationId: "test-location-bookstore",
    locationName: "Bookstore",
    status: "REVIEW",
    createdBy: "Alex",
    startedAt: hoursAgo(9),
    updatedAt: hoursAgo(1, 5),
    notes: "Bookstore count ready for review.",
    lines: [
      {
        productTitle: "Modern Art: A Visitor's Guide",
        variantTitle: "Paperback",
        vendor: "Museum Press",
        productType: "Books",
        sku: "BOOK-MODERN-PB",
        barcode: "9781940001010",
        startingQuantity: 11,
        countedQuantity: 11,
      },
      {
        productTitle: "Children's Museum Activity Book",
        variantTitle: "Paperback",
        vendor: "Museum Press",
        productType: "Books",
        sku: "BOOK-KIDS-ACT",
        barcode: "9781940001027",
        startingQuantity: 8,
        countedQuantity: 7,
      },
      {
        productTitle: "Gallery Sketchbook",
        variantTitle: "A5",
        vendor: "Museum Paper Goods",
        productType: "Stationery",
        sku: "STAT-SKETCH-A5",
        barcode: "810000200018",
        startingQuantity: 6,
        countedQuantity: 6,
      },
    ],
  },
  {
    countNumber: "003",
    name: "[TEST] Count: 003",
    locationId: "test-location-museum-store",
    locationName: "Museum Store",
    status: "COMPLETED",
    createdBy: "Morgan",
    startedAt: hoursAgo(14),
    completedAt: hoursAgo(3),
    updatedAt: hoursAgo(3),
    notes: "Completed development count with a positive total variance.",
    lines: [
      {
        productTitle: "Stained Glass Ornament",
        variantTitle: "Amber",
        vendor: "Museum Artisans",
        productType: "Ornaments",
        sku: "ORN-GLASS-AMB",
        barcode: "810000300015",
        startingQuantity: 8,
        countedQuantity: 9,
      },
      {
        productTitle: "Impressionist Landscape Mug",
        variantTitle: "15 oz",
        vendor: "Gallery Ceramics",
        productType: "Mugs",
        sku: "MUG-IMPRESS-15",
        barcode: "810000300022",
        startingQuantity: 12,
        countedQuantity: 10,
      },
      {
        productTitle: "Botanical Pendant",
        variantTitle: "Gold Plate",
        vendor: "Heritage Jewelry",
        productType: "Jewelry",
        sku: "JEW-BOT-GOLD",
        barcode: "810000300039",
        startingQuantity: 6,
        countedQuantity: 6,
      },
      {
        productTitle: "Museum Icons Tote Bag",
        variantTitle: "Black",
        vendor: "Museum Textiles",
        productType: "Tote Bags",
        sku: "TOTE-ICONS-BLK",
        barcode: "810000300046",
        startingQuantity: 10,
        countedQuantity: 13,
      },
    ],
  },
  {
    countNumber: "004",
    name: "[TEST] Count: 004",
    locationId: "test-location-offsite-event-storage",
    locationName: "Offsite Event Storage",
    status: "CANCELLED",
    createdBy: "Taylor",
    startedAt: hoursAgo(12),
    completedAt: hoursAgo(4),
    updatedAt: hoursAgo(4),
    notes: "Cancelled after the event inventory was moved.",
    lines: [
      {
        productTitle: "Traveling Exhibition Puzzle",
        variantTitle: "500 pieces",
        vendor: "Gallery Games",
        productType: "Puzzles",
        sku: "PUZ-TRAVEL-500",
        barcode: "810000400012",
        startingQuantity: 5,
        countedQuantity: 2,
      },
      {
        productTitle: "Pop-Up Museum Logo Magnet",
        variantTitle: null,
        vendor: "Museum Souvenirs",
        productType: "Magnets",
        sku: "MAG-POPUP-LOGO",
        barcode: "810000400029",
        startingQuantity: 7,
        countedQuantity: 0,
      },
    ],
  },
];

async function createTestCount(transaction, countDefinition) {
  const { countNumber, lines, ...countData } = countDefinition;
  const inventoryCount = await transaction.inventoryCount.create({
    data: {
      shop: TEST_SHOP,
      ...countData,
    },
  });

  for (const [index, lineDefinition] of lines.entries()) {
    const wasCounted = lineDefinition.countedQuantity > 0;
    const scannedAt = wasCounted
      ? hoursAgo(5 - index * 0.35 + Number(countNumber) * 0.15)
      : null;
    const inventoryCountLine = await transaction.inventoryCountLine.create({
      data: {
        inventoryCountId: inventoryCount.id,
        inventoryItemId: `test-inventory-item-${countNumber}-${index + 1}`,
        productId: `test-product-${countNumber}-${index + 1}`,
        variantId: `test-variant-${countNumber}-${index + 1}`,
        ...lineDefinition,
        status: wasCounted
          ? countData.status === "COMPLETED"
            ? "APPROVED"
            : "COUNTED"
          : "UNCOUNTED",
        firstScannedAt: scannedAt,
        lastScannedAt: scannedAt,
        approvedQuantity:
          countData.status === "COMPLETED"
            ? lineDefinition.countedQuantity
            : null,
      },
    });

    if (wasCounted) {
      await transaction.inventoryScanEvent.create({
        data: {
          inventoryCountId: inventoryCount.id,
          inventoryCountLineId: inventoryCountLine.id,
          barcode: lineDefinition.barcode,
          quantityChange: lineDefinition.countedQuantity,
          scannedBy: countData.createdBy,
          scannedAt,
          deviceId: TEST_DEVICE_ID,
          result: "SUCCESS",
        },
      });
    }
  }
}

async function main() {
  await prisma.$transaction(async (transaction) => {
    await transaction.inventoryCount.deleteMany({
      where: { name: { startsWith: "[TEST]" } },
    });

    for (const count of counts) {
      await createTestCount(transaction, count);
    }
  });

  console.log("Fake inventory counts created.");
  console.log("\nOpen:\n\n/app/inventory-counts\n\nto review the page.");
}

main()
  .catch((error) => {
    console.error("Failed to create fake inventory counts.", error);
    // eslint-disable-next-line no-undef
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
