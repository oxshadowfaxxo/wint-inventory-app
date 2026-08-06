ALTER TABLE "InventoryCount" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "InventoryCount_shop_archivedAt_idx" ON "InventoryCount"("shop", "archivedAt");
