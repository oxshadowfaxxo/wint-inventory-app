# Winterthur Inventory App --- Build Checklist

**Updated: August 14, 2026**

## Phase 1 --- Application Foundation ✅

-   [x] Create Shopify embedded app
-   [x] Configure development store (`winterthur-test.myshopify.com`)
-   [x] Connect Neon PostgreSQL
-   [x] Configure Prisma
-   [x] Create inventory count database models
    -   [x] InventoryCount
    -   [x] InventoryCountLine
    -   [x] InventoryScanEvent
-   [x] Shopify authentication
-   [x] Configure Shopify API access
    -   [x] Products
    -   [x] Inventory
    -   [x] Locations
-   [x] Connect Shopify GraphQL Admin API
-   [x] Create development/test inventory seed data
-   [x] Establish Git/GitHub development workflow

## Phase 2 --- Inventory Count Management ✅

### Inventory Counts Page

-   [x] Create Inventory Counts page
-   [x] Display all counts in one unified list
-   [x] Sequential count numbers (`001`, `002`, `003`...)
-   [x] Display count status, Shopify location, area, employee, dates,
    product progress, and quantity progress
-   [x] Search counts
-   [x] Filter counts by status
-   [x] Sort count-list columns
-   [x] Archive counts
-   [x] Hide archived counts by default
-   [x] Show archived counts option
-   [x] Restore/unarchive counts
-   [x] Remove Cancel Count workflow
-   [x] Preserve historical CANCELLED records

### Count Detail Page

-   [x] Read-only count preview
-   [x] Count summary
-   [x] Notes field
-   [x] Continue Counting
-   [x] Move primary actions into page header
-   [x] Keep completed counts read-only

## Phase 3 --- Create New Inventory Count ✅

-   [x] New Count workflow
-   [x] Select Shopify location
-   [x] Enter store area/room
-   [x] Enter employee name
-   [x] Generate sequential count number
-   [x] Load and select Shopify product types
-   [x] Query Shopify products and inventory at selected location
-   [x] Include zero-inventory variants
-   [x] Capture starting Shopify inventory
-   [x] Create frozen inventory snapshot
-   [x] Preview count before counting
-   [x] Start count in COUNTING mode

## Phase 4 --- Active Counting Workflow 🟢

### Product Table

-   [x] Display product title, variant, SKU, barcode, expected quantity,
    counted quantity, variance, and status
-   [x] Frozen first/product column
-   [x] Horizontal scrolling
-   [x] Prevent text wrapping
-   [x] Sort text columns A--Z / Z--A
-   [x] Sort numeric columns low--high / high--low

### Manual Counting

-   [x] Manual counted-quantity entry
-   [x] Native numeric spinner controls
-   [x] Minimum quantity of zero
-   [x] Distinguish counted zero from uncounted
-   [x] Update variance, product progress, and quantity progress

### Product Search & Management

-   [x] Search products already in count by title, variant, SKU, or
    barcode
-   [x] Search Shopify to add products
-   [x] Add product to active count
-   [x] Capture Shopify inventory when product is added
-   [x] Prevent duplicate variants
-   [x] Add products outside original product-type scope
-   [x] Multi-select and remove multiple products
-   [x] Recalculate totals after removal

### Count State

-   [x] COUNTING state
-   [x] Save & Exit → DRAFT
-   [x] Continue Counting → COUNTING
-   [x] Finish Counting
-   [x] Warn about uncounted variants
-   [x] Allow employee to return and continue
-   [x] Allow employee to commit uncounted items
-   [x] REVIEW state
-   [x] COMPLETED state
-   [x] Remove user-facing cancellation workflow
-   [x] Archive unwanted/incomplete counts instead

### Counting UI

-   [x] Remove unnecessary Count Summary from active counting screen
-   [x] Remove separate Counting Actions card
-   [x] Save & Exit in page header
-   [x] Finish Counting in page header
-   [ ] Final counting-screen UI polish

## Phase 5 --- Barcode Scanning 🟢

### Core Scanner

-   [x] Barcode input
-   [x] USB/Bluetooth scanner-as-keyboard support
-   [x] Exact barcode lookup
-   [x] Find InventoryCountLine
-   [x] Increment quantity by one per scan
-   [x] Atomic database increment
-   [x] Update first/last scanned timestamps and count status
-   [x] Clear and refocus scanner field
-   [x] Highlight and scroll matching product row into view
-   [x] Support repeated scans of same barcode
-   [x] Update totals after scan
-   [x] Handle barcode not found
-   [x] Detect duplicate barcode matches

### Scan/Search Interface

-   [x] Combined Scan or Search interface
-   [x] Manual product lookup from counting screen
-   [x] Barcode scanning remains +1 operation
-   [x] Manual search can locate existing count products
-   [ ] Additional scanner UI refinement after employee testing

### Future Scanner Features

-   [ ] Camera barcode scanning
-   [ ] Optional scan success/error sounds
-   [ ] Quick-add unknown barcode from Shopify
-   [ ] Scanner performance testing with production-size counts
-   [ ] Physical scanner testing

## Phase 6 --- Review & Reconciliation ⏭ NEXT MAJOR FUNCTIONAL MILESTONE

### Variance Review

-   [ ] Dedicated variance review interface
-   [ ] Filter over-counted, under-counted, exact-match, and uncounted
    products
-   [ ] Sort by largest variance
-   [ ] Variance percentage
-   [ ] Recount selected products
-   [ ] Notes on discrepancies
-   [ ] Mark discrepancy reviewed
-   [ ] Review completion workflow

### Inventory Verification

-   [ ] Refresh current Shopify inventory before adjustment
-   [ ] Compare original Shopify quantity, physical counted quantity,
    and current Shopify quantity
-   [ ] Detect Shopify inventory changes during counting
-   [ ] Flag conflicts before adjustment
-   [ ] Adjustment preview

### Approval

-   [ ] Approve individual adjustments
-   [ ] Approve multiple adjustments
-   [ ] Reject/ignore adjustment
-   [ ] Final adjustment confirmation
-   [ ] Prevent accidental Shopify writes

## Phase 7 --- Shopify Inventory Updates

**Keep disabled until reconciliation is complete and tested.**

-   [ ] Enable Complete and Apply Approved Inventory Adjustments
-   [ ] Shopify inventory mutation
-   [ ] Apply only approved adjustments
-   [ ] Batch inventory adjustments
-   [ ] Idempotency protection
-   [ ] Concurrency protection
-   [ ] Error and partial-failure handling
-   [ ] Record adjustment result
-   [ ] Lock completed/applied counts
-   [ ] Prevent duplicate application
-   [ ] Test against development store
-   [ ] Production safety review

## Phase 8 --- Audit & Reporting

### CSV

-   [ ] Export Count Summary CSV
-   [ ] Export complete product-level count
-   [ ] Include original quantity, counted quantity, variance, SKU,
    barcode, vendor, product type, location, area, employee, count
    number, and timestamps
-   [ ] Adjustment CSV
-   [ ] Unknown barcode report

### Audit History

-   [ ] Formal scan audit log
-   [ ] Adjustment audit log
-   [ ] Product-added history
-   [ ] Product-removed history
-   [ ] Inventory-application history
-   [ ] Count status history

### Reports

-   [ ] Printable variance report
-   [ ] Inventory shrink report
-   [ ] Inventory overage report
-   [ ] Inventory value variance
-   [ ] PDF audit report
-   [ ] Email audit reports

## Phase 9 --- Shopify POS & Multi-Device

-   [ ] Shopify POS Extension
-   [ ] POS Scanner API evaluation
-   [ ] Launch count from Shopify POS
-   [ ] Multi-device counting
-   [ ] Concurrent scan handling
-   [ ] Employee identification per device
-   [ ] Section assignments
-   [ ] Live progress dashboard
-   [ ] Device/session tracking

## Future Enhancements

### Counting

-   [ ] Cycle counts
-   [ ] Blind counting mode
-   [ ] Vendor-specific counts
-   [ ] Scheduled counts
-   [ ] Department/category counts
-   [ ] Shelf/section assignments
-   [ ] Count templates

### Operations

-   [ ] Inventory-count analytics dashboard
-   [ ] Count duration
-   [ ] Products counted per hour
-   [ ] Scan rate
-   [ ] Accuracy percentage
-   [ ] Historical variance trends
-   [ ] Shrink trends
-   [ ] Employee productivity reporting

### Advanced

-   [ ] Offline counting
-   [ ] Resume count on another device
-   [ ] Camera scanning
-   [ ] Barcode label printing
-   [ ] Automated scheduled cycle counts

## Current Development Priority

1.  **Finish remaining counting-screen UI polish**
2.  **Test barcode scanning with a physical scanner**
3.  **Build Variance Review**
4.  **Build recount/discrepancy workflow**
5.  **Build CSV audit export**
6.  **Only then enable Shopify inventory adjustments**

## Current Overall Status

**Foundation:** Complete\
**Count management:** Complete\
**Count creation:** Complete\
**Manual counting:** Complete\
**Barcode core:** Complete / testing & polish remaining\
**Reconciliation:** Not started\
**Shopify inventory writes:** Intentionally disabled\
**Audit/reporting:** Not started\
**POS integration:** Future milestone
