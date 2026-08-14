CREATE TYPE "InventoryCountType" AS ENUM ('PRODUCT_TYPE', 'BLANK_SCAN');

ALTER TABLE "InventoryCount"
ADD COLUMN "countType" "InventoryCountType" NOT NULL DEFAULT 'PRODUCT_TYPE';
