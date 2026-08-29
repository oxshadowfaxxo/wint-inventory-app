-- AlterTable
ALTER TABLE "InventoryCount"
ADD COLUMN "reviewInventoryRefreshedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InventoryCountLine"
ADD COLUMN "reviewShopifyQuantity" INTEGER,
ADD COLUMN "reviewShopifyRefreshedAt" TIMESTAMP(3);
