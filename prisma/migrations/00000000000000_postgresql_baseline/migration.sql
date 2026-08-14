-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InventoryCountStatus" AS ENUM ('DRAFT', 'COUNTING', 'REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryLineStatus" AS ENUM ('UNCOUNTED', 'COUNTED', 'RECOUNT', 'APPROVED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "InventoryCountType" AS ENUM ('PRODUCT_TYPE', 'BLANK_SCAN');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "countNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "productTypes" JSONB NOT NULL,
    "countType" "InventoryCountType" NOT NULL DEFAULT 'PRODUCT_TYPE',
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountLine" (
    "id" TEXT NOT NULL,
    "inventoryCountId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT,
    "vendor" TEXT,
    "productType" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "startingQuantity" INTEGER,
    "countedQuantity" INTEGER NOT NULL DEFAULT 0,
    "committedUncounted" BOOLEAN NOT NULL DEFAULT false,
    "approvedQuantity" INTEGER,
    "status" "InventoryLineStatus" NOT NULL DEFAULT 'UNCOUNTED',
    "note" TEXT,
    "firstScannedAt" TIMESTAMP(3),
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryScanEvent" (
    "id" TEXT NOT NULL,
    "inventoryCountId" TEXT NOT NULL,
    "inventoryCountLineId" TEXT,
    "barcode" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL DEFAULT 1,
    "scannedBy" TEXT,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT,
    "result" TEXT NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "InventoryScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryCount_shop_locationId_idx" ON "InventoryCount"("shop", "locationId");

-- CreateIndex
CREATE INDEX "InventoryCount_shop_status_idx" ON "InventoryCount"("shop", "status");

-- CreateIndex
CREATE INDEX "InventoryCount_shop_archivedAt_idx" ON "InventoryCount"("shop", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCount_shop_countNumber_key" ON "InventoryCount"("shop", "countNumber");

-- CreateIndex
CREATE INDEX "InventoryCountLine_inventoryCountId_idx" ON "InventoryCountLine"("inventoryCountId");

-- CreateIndex
CREATE INDEX "InventoryCountLine_barcode_idx" ON "InventoryCountLine"("barcode");

-- CreateIndex
CREATE INDEX "InventoryCountLine_status_idx" ON "InventoryCountLine"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountLine_inventoryCountId_inventoryItemId_key" ON "InventoryCountLine"("inventoryCountId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryScanEvent_inventoryCountId_idx" ON "InventoryScanEvent"("inventoryCountId");

-- CreateIndex
CREATE INDEX "InventoryScanEvent_barcode_idx" ON "InventoryScanEvent"("barcode");

-- CreateIndex
CREATE INDEX "InventoryScanEvent_scannedAt_idx" ON "InventoryScanEvent"("scannedAt");

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryScanEvent" ADD CONSTRAINT "InventoryScanEvent_inventoryCountId_fkey" FOREIGN KEY ("inventoryCountId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryScanEvent" ADD CONSTRAINT "InventoryScanEvent_inventoryCountLineId_fkey" FOREIGN KEY ("inventoryCountLineId") REFERENCES "InventoryCountLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
