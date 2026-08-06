ALTER TABLE "InventoryCount" ADD COLUMN "area" TEXT;
ALTER TABLE "InventoryCount" ADD COLUMN "countNumber" INTEGER;
ALTER TABLE "InventoryCount" ADD COLUMN "productTypes" JSONB;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "shop" ORDER BY "createdAt", "id") AS sequence
  FROM "InventoryCount"
)
UPDATE "InventoryCount" AS count
SET "countNumber" = numbered.sequence,
    "area" = 'Unspecified',
    "productTypes" = '["__ALL__"]'::jsonb
FROM numbered
WHERE count."id" = numbered."id";

ALTER TABLE "InventoryCount" ALTER COLUMN "area" SET NOT NULL;
ALTER TABLE "InventoryCount" ALTER COLUMN "countNumber" SET NOT NULL;
ALTER TABLE "InventoryCount" ALTER COLUMN "productTypes" SET NOT NULL;
CREATE UNIQUE INDEX "InventoryCount_shop_countNumber_key" ON "InventoryCount"("shop", "countNumber");
