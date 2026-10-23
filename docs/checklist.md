# Winterthur Inventory App --- Build Checklist

**Updated: September 8, 2026 — v0.3**

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
-   [x] Archived-only status view
-   [x] Multi-select counts and archive selected counts
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
-   [x] Product titles link directly to the Shopify Admin product page
-   [x] Responsive tablet/mobile action menus for count and review screens

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
-   [x] Support Product Type counts
-   [x] Support Blank Scan counts without a preloaded product sheet

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
-   [x] Tablet/mobile three-dot action menu at ≤50rem
-   [x] Preserve direct header actions on desktop
-   [ ] Final counting-screen UI polish after employee testing

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
-   [x] Scan success/error sounds intentionally excluded from scope
-   [ ] Quick-add unknown barcode from Shopify
-   [x] Scanner performance testing with production-size counts
-   [x] Physical scanner testing

## Phase 6 --- Review & Reconciliation 🟢 IN PROGRESS

### Variance Review

-   [x] Review-state product table with reconciliation columns
-   [ ] Dedicated variance filtering interface
-   [ ] Filter over-counted, under-counted, exact-match, and uncounted
    products
-   [ ] Sort by largest variance
-   [ ] Variance percentage
-   [ ] Recount selected products
-   [ ] Notes on discrepancies
-   [ ] Mark discrepancy reviewed
-   [ ] Review completion workflow

### Inventory Verification

-   [x] Automatically refresh current Shopify inventory when entering Review
-   [x] Manual Refresh Shopify Quantities action
-   [x] Store review refresh timestamp
-   [x] Store refreshed Shopify quantity per count line
-   [x] Compare starting Shopify quantity, physical counted quantity, and
    current Shopify quantity
-   [x] Display Shopify Change since the count started
-   [x] Display Review Variance against current Shopify quantity
-   [x] Allow return from REVIEW to COUNTING
-   [ ] Add explicit conflict flags for Shopify inventory changes during counting
-   [ ] Adjustment preview

### Approval

-   [ ] Approve individual adjustments
-   [ ] Approve multiple adjustments
-   [ ] Reject/ignore adjustment
-   [ ] Final adjustment confirmation
-   [x] Keep Shopify inventory-write action disabled in v0.3
-   [x] Allow completion without changing Shopify inventory, with confirmation
-   [ ] Prevent accidental Shopify writes once adjustment mutations are enabled

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

1.  **Employee-test the v0.3 counting and responsive tablet workflow**
2.  **Test barcode scanning with a physical scanner and production-size counts**
3.  **Add variance filters, conflict flags, and discrepancy review controls**
4.  **Build selected-product recount/discrepancy workflow**
5.  **Build adjustment approval/preview workflow**
6.  **Build CSV audit export**
7.  **Only then enable Shopify inventory adjustments**

## Current Overall Status

**Foundation:** Complete\
**Count management:** Complete\
**Count creation:** Complete\
**Manual counting:** Complete\
**Barcode core:** Complete / physical testing & polish remaining\
**Responsive count workflow:** Implemented in v0.3 / employee testing remaining\
**Review & reconciliation:** In progress — Shopify refresh and comparison implemented\
**Shopify inventory writes:** Intentionally disabled\
**Audit/reporting:** Not started\
**POS integration:** Future milestone

## v0.4 — Barcode Error Sound

- [x] Settings page at `/app/settings`, available in embedded app navigation.
- [x] Scanner & Audio controls: Enable Error Sound, 0–100% volume, and Test Error Sound.
- [x] Defaults: enabled, 70%; automatic device/browser-specific localStorage using `winterthur-inventory:barcode-error-audio:v1`.
- [x] Safe SSR and blocked-storage fallback; preferences remain usable in memory if persistence is unavailable.
- [x] Two low 220 Hz tones, 150 ms each with an 80 ms pause; no application success sound.
- [x] Scanner and manual barcode validation failures use the same error sound; unrelated errors remain silent.
- [x] Explicit unmatched local submissions sound once; typing/searching alone remains silent. Existing Product Type search behavior is preserved without adding Shopify lookups.
- [x] Server barcode validation codes and duplicate barcode responses trigger audio only after processing finishes.
- [x] User gestures initialize audio; unsupported/blocked audio cannot interrupt counting. Alerts during an active pair are skipped to avoid overlap/backlogs.
- [x] Scanner configuration, hardware beep, count persistence, quantity operations, and Shopify inventory writes unchanged.
- [ ] Physical S700 and desktop/tablet browser listening tests, including volume, device independence, refresh/reopen persistence, and autoplay policies.

Manual verification: open Settings, preview the pair, change volume, disable and preview (silent), then refresh/reopen to verify preferences. On a second browser/device verify the enabled/70% defaults. In counting mode scan and manually submit valid and invalid barcodes, including an outside-count product and a duplicate barcode. Successful counts must stay silent, validation failures must alert once, and rapid failures must not overlap. Verify quantity/highlight/persistence and review flows still work. Browser/OS mute, autoplay policy, or unavailable Web Audio can prevent audible playback; storage restrictions can prevent persistence. No scanner identification is needed.

## v0.4 — Review Count Filtering & Sorting

- [x] Collapsed-by-default Filters panel above the Review Count table, with responsive wrapping controls.
- [x] Show Only: All Products, Variances Only, Shortages Only, Overages Only, Matches Only, and Not Counted.
- [x] Multiple removable Quantity Variance, Shopify Quantity, Counted Quantity, and Count Status conditions; numeric comparisons require a valid value.
- [x] ALL (AND) or ANY (OR) among custom conditions, always within the Show Only selection.
- [x] Apply Filters applies draft filters and sorting together; collapsing preserves selections. Clear All immediately resets the complete view and original line order.
- [x] Product Title, SKU, Shopify Quantity, Counted Quantity, Quantity Variance, and Absolute Variance sorting in either direction, using existing stable sorting logic. Original Order preserves the existing default.
- [x] Review sorting controls are confined to the Filters panel; other tables retain their existing sortable headers.
- [x] Shopify Quantity uses `reviewShopifyQuantity`; Quantity Variance remains Counted minus Current Shopify. Missing snapshot quantities remain unknown and do not satisfy numeric/variance conditions. Sorting retains the existing null ordering.
- [x] Not Counted uses `UNCOUNTED` status, including committed-as-uncounted lines; an explicitly counted zero remains Counted.
- [x] Filters operate on the full loaded review dataset, display a clear empty state, and live only in component state. No storage, URL parameters, server actions, quantity changes, or Prisma changes are involved.
- [x] Review component resets on leaving Review Count or switching counts. Existing summary calculations, table columns, sticky behavior, refresh, return-to-counting, and completion actions are preserved.
- [x] Isolated browser preview with sample data verified expand/collapse, delayed Apply, numeric validation, AND/OR results, empty results, remove, Clear All, absolute sorting, fresh-visit reset, and wrapping at 390/768/1200 px container widths.
- [ ] Browser/employee verification on desktop, tablet, and mobile: toggle panel, change draft filters without applying, apply AND/OR combinations, remove conditions, clear, sort both directions, check empty state, and navigate away/back to confirm reset.

Automated checks: `node --test app/features/inventory-counts/utils/review-count-filters.test.js` covers Show Only options, comparisons, AND/OR scope, statuses, missing Shopify quantities, stable/absolute sorting, default resets, and source-data immutability. Inventory adjustments and Shopify writes remain unchanged.
