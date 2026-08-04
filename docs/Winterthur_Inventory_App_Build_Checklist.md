# Winterthur Inventory App -- Build Checklist

## Phase 1 -- Safe Counting MVP

-   [ ] Create Shopify embedded app
-   [ ] Connect Neon PostgreSQL
-   [ ] Configure Prisma models
-   [ ] Add Shopify authentication
-   [ ] Request scopes:
    -   [ ] read_products
    -   [ ] read_inventory
    -   [ ] write_inventory
    -   [ ] read_locations
-   [ ] Create Inventory Count session page
-   [ ] Select Shopify location
-   [ ] Barcode scan screen
-   [ ] Lookup variant by barcode
-   [ ] Increment count on scan
-   [ ] Display product image, SKU, title
-   [ ] Store scan events
-   [ ] Manual quantity adjustment
-   [ ] Variance report
-   [ ] Unknown barcode report
-   [ ] Export Count Summary CSV

## Phase 2 -- Reconciliation

-   [ ] Review screen
-   [ ] Recount workflow
-   [ ] Notes on discrepancies
-   [ ] Approval workflow
-   [ ] Refresh Shopify inventory before apply
-   [ ] Vendor filter
-   [ ] Product Type filter
-   [ ] Scan audit log
-   [ ] Adjustment preview

## Phase 3 -- Update Shopify Inventory

-   [ ] Apply inventory updates
-   [ ] Idempotency keys
-   [ ] Concurrency protection
-   [ ] Batch adjustments
-   [ ] Error handling
-   [ ] Lock completed counts
-   [ ] Adjustment CSV export

## Phase 4 -- POS Integration

-   [ ] Shopify POS Extension
-   [ ] POS Scanner API
-   [ ] Multi-device counting
-   [ ] Employee identification
-   [ ] Section assignments
-   [ ] Live progress dashboard

## Future Ideas

-   [ ] Cycle counts
-   [ ] Blind counting mode
-   [ ] Vendor-specific counts
-   [ ] Scheduled counts
-   [ ] Printable variance reports
-   [ ] Email audit reports
-   [ ] Analytics dashboard
