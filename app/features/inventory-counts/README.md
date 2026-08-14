# Inventory counts

The authenticated inventory-count feature provides the list, two-step New Count workflow, dedicated counting mode, and read-only detail preview.

## Unified count list and archive

`/app/inventory-counts` displays DRAFT, COUNTING, REVIEW, COMPLETED, and CANCELLED records in one compact All Counts table. Search matches count number, location, area, employee, and status. The `status` URL parameter preserves the selected status filter, and `archived=show` preserves archived visibility across reloads. Archived counts are hidden by default and display an Archived badge when shown.

All list columns are sortable. Count, progress, quantity, and variance use numeric comparisons; dates use timestamps; text uses case-insensitive, locale-aware natural comparison. The default order is Last activity descending. Filtering is applied in archive, search, status, then sort order.

DRAFT, COUNTING, REVIEW, COMPLETED, and historical CANCELLED counts can all be archived. Archiving is the way to hide an abandoned count from the active list and records `archivedAt` without changing status or deleting the count, its lines, scans, notes, or events. Incomplete counts use stronger confirmation copy. Unarchive clears only `archivedAt`, restores list visibility, and preserves the current status. Both operations authenticate, scope by shop and count ID, validate the current database state, and require confirmation in the list UI.

## New Count workflow

Every count stores an explicit `countType`: `PRODUCT_TYPE` (the default for existing records) or `BLANK_SCAN`. Product Type Count retains the frozen, preloaded workflow described below. Blank Scan Count requires only location, area, and employee; its preview reports zero starting products and quantity, and creation writes a `COUNTING` count with zero lines without reading the product catalog for a snapshot.

`/app/inventory-counts/new` first loads active locations and product types from the authenticated shop through the GraphQL Admin API. The employee selects a location and product-type scope and enters a trimmed, count-specific area and employee name. Preview reads Shopify without writing to PostgreSQL. Create revalidates the choices, fetches a fresh snapshot, creates the count as `COUNTING`, records `startedAt`, and redirects to `/app/inventory-counts/:countId/count`; browser-provided totals are never trusted.

Locations come from the paginated `locations` connection and inactive locations are excluded. Product types are derived from cursor-paginated active product variants. `__ALL__` represents all product types and `__UNCATEGORIZED__` represents a blank product type.

The scope includes only ACTIVE products, tracked inventory items, and variants with an inventory level at the selected location. Zero-on-hand variants and variants without a SKU or barcode remain in scope. DRAFT/ARCHIVED products, untracked items, and variants not stocked at the location are excluded.

Expected quantity comes only from the location inventory level's named `on_hand` quantity. A missing `on_hand` value fails the entire operation. Every line stores a frozen integer `startingQuantity`; later Shopify changes do not update it.

Count numbers are integers scoped by shop and displayed with three-digit padding. A serializable transaction calculates the next value and creates the count plus all lines atomically. The `[shop, countNumber]` unique constraint and retry handling make concurrent allocation safe and prevent reuse of historical numbers.

Before preview and creation, active DRAFT, COUNTING, and REVIEW counts are compared by shop, location, normalized (trimmed, case-insensitive) area, and intersecting product-type scope. `__ALL__` overlaps every scope. A warning names matches and creation requires explicit confirmation.

## Status workflow

All transitions are authenticated, scoped by count ID and shop, and guarded by the current database status. `COUNTING` can be saved to `DRAFT` or finished to `REVIEW`. `DRAFT` can continue to `COUNTING`. `REVIEW` can return to `COUNTING` or complete without Shopify changes. `COMPLETED` and historical `CANCELLED` records are terminal and read-only. Cancel Count is no longer a user action, so the application does not create new CANCELLED records.

A line is unresolved only when it remains `UNCOUNTED`, has `countedQuantity` zero, has no `firstScannedAt`, and is not `committedUncounted`. Finishing with unresolved lines requires confirmation. Confirmed lines retain `UNCOUNTED`, zero quantity, and null scan timestamps while `committedUncounted = true` records the audit distinction. They count as resolved in progress without being represented as physical scans.

Existing CANCELLED records remain visible, filterable, archivable, and restorable for historical compatibility. Their stored statuses and existing cancellation notes are not rewritten.

## Manual counting and product search

Counting mode provides row-scoped decrease, direct-entry, and increase controls. Updates are saved immediately through React Router fetchers and server-side serializable transactions. Increment and decrement read the database quantity instead of trusting browser state. Quantities are PostgreSQL integers from 0 through 2,147,483,647; negative, blank, decimal, and out-of-range values are rejected.

The first manual edit sets `firstScannedAt`, every edit updates `lastScannedAt`, the line becomes `COUNTED`, and `committedUncounted` is cleared. A manual count of zero therefore has a first-count timestamp and `COUNTED` status, while a never-counted zero remains `UNCOUNTED` without a first-count timestamp.

The unified Scan or Search field searches only the count's frozen lines in the browser, case-insensitively and partially across product title, variant title, SKU, and barcode. Results rank exact barcode, exact SKU, partial barcode, partial SKU, product title, then variant title, and show at most 10 rows plus the total match count. It never queries or modifies Shopify.

Add Product performs separate Shopify Admin GraphQL searches for exact barcode, exact SKU, and product title, then merges and deduplicates results in that order with a 20-variant limit. Only active, tracked variants stocked at the count location with a named `on_hand` quantity are shown. The selected variant is fetched and validated again on Add. Its current `on_hand` becomes the frozen `startingQuantity`; zero is valid. Extra products may be outside the original product-type scope and do not change `InventoryCount.productTypes`.

`InventoryCount.createdBy` is currently assumed to be the employee making all manual edits and product additions. Separate editor audit records are not yet stored.

## Scan or Search

For `BLANK_SCAN`, the empty count remains usable and prompts the employee to scan the first product. An exact barcode not already in the count is looked up with the authenticated Shopify GraphQL Admin API. Exactly one ACTIVE, inventory-tracked variant must match. It must have an inventory level at the count location and an integer named `on_hand` quantity; stocked inventory with `on_hand = 0` is valid, while a missing level is reported as not stocked and is not treated as zero. No line is written for missing, ambiguous, inactive, untracked, not-stocked, or missing-on-hand results. Ambiguous results include product, variant, and SKU details.

The first valid Blank Scan scan creates one line directly with `countedQuantity = 1`, `status = COUNTED`, both scan timestamps set, and a frozen `startingQuantity` equal to Shopify `on_hand` at that moment. Later Shopify changes never refresh this value. Repeat scans use an atomic increment without another Shopify lookup. The `[inventoryCountId, inventoryItemId]` unique constraint resolves concurrent first-scan races: a losing create retries as an increment, preventing duplicate rows and lost scans.

Manual Add Product behaves consistently in either mode: it captures current Shopify `on_hand`, creates an `UNCOUNTED` line with quantity zero, and does not represent a physical scan. A later scan increments it to one. Blank Scan progress reports unique variants added, physical quantity counted, summed frozen Shopify starting quantity, and variance; it does not imply a predefined product universe.

Counting mode uses one Scan or Search combobox for USB/Bluetooth scanners and manual product lookup. Exact barcode plus Enter has priority and invokes the authenticated scan action. Partial text displays an accessible listbox; Arrow Up and Arrow Down move the active option, Escape closes it, and Enter selects the active result when there is no exact barcode match.

The authenticated `scan-barcode` action scopes the count by ID and session shop, requires `COUNTING`, trims the value, and first uses exact barcode equality against existing count lines. A single match is updated with Prisma's atomic `countedQuantity: { increment: 1 }`. The first scan timestamp is set once, the last scan timestamp is refreshed, status becomes `COUNTED`, and `committedUncounted` is cleared. Product Type counts preserve the existing not-found/Add Product flow and do not automatically expand their sheet.

Selecting a manual result never changes quantity. It collapses the result panel and uses the stable line ID to scroll to and temporarily highlight the row at its current sorted position. The employee can then use the existing quantity control. Exact scans use the same row-location behavior after loader revalidation updates quantities, progress, variance, and status.

Scans are queued in order and sent one at a time, so rapid repeated scans are not debounced or collapsed. Duplicate exact barcodes are still resolved by the server and change neither line. During Remove Products mode, barcode increments are disabled while manual lookup remains available and may only locate/highlight a row. Add Product remains the explicit Shopify-catalog search path for empty local results.

## Removing products

While a count is `COUNTING`, Remove Products enables a temporary client-side selection mode. Row checkboxes select individual frozen lines, and Select All affects all displayed rows. Cancellation clears the selection without changing PostgreSQL.

Removal requires confirmation and may include uncounted, counted, originally snapshotted, or manually added lines. Product Type counts must retain at least one line; Blank Scan counts may return to an empty sheet. The server verifies the authenticated shop, `COUNTING` status, and ownership of every submitted line ID before deleting only those `InventoryCountLine` records. React Router then revalidates the count so variant, expected, counted, variance, and visible-row totals recalculate from the remaining lines.

Removing a line never changes Shopify inventory, the Shopify product, the count number, or the stored original `productTypes` scope. Related `InventoryScanEvent` records are preserved because the line relation uses `onDelete: SetNull`; their `inventoryCountLineId` becomes null. Removed-line details are not yet copied into a dedicated removal audit table.

## Product table sorting

Counting and read-only product tables share client-side sorting for Product, Variant, SKU, Barcode, Expected, Counted, Variance, and Status. Headers cycle ascending, descending, then back to the original loader order; Reset Sort is also available while sorting is active. Text comparisons are case-insensitive, locale-aware, and numeric-aware. Blank text values appear after populated values ascending and before them descending. Expected, counted, and variance columns use numeric values.

The unified lookup does not filter or reorder the table, so active sorting remains unchanged when a result is selected. Removal selections remain keyed by line ID when rows reorder.

## Current limitations

- Camera, offline, sound, vibration, and batch barcode scanning are not implemented.
- Product Type counts require deliberate Add Product for unknown barcodes; Blank Scan counts add validated exact Shopify barcode matches automatically.
- Separate editor audit records are not implemented.
- Shopify inventory is never written.
- CSV export is not implemented.
