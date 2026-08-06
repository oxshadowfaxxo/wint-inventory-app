# Inventory counts

The authenticated inventory-count feature provides the list, two-step New Count workflow, dedicated counting mode, and read-only detail preview.

## Unified count list and archive

`/app/inventory-counts` displays DRAFT, COUNTING, REVIEW, COMPLETED, and CANCELLED records in one compact All Counts table. Search matches count number, location, area, employee, and status. The `status` URL parameter preserves the selected status filter, and `archived=show` preserves archived visibility across reloads. Archived counts are hidden by default and display an Archived badge when shown.

All list columns are sortable. Count, progress, quantity, and variance use numeric comparisons; dates use timestamps; text uses case-insensitive, locale-aware natural comparison. The default order is Last activity descending. Filtering is applied in archive, search, status, then sort order.

Only COMPLETED and CANCELLED counts can be archived. Archiving records `archivedAt` without changing status or deleting the count, its lines, or events. Unarchive clears `archivedAt`. Both operations authenticate, scope by shop and count ID, validate the current database state, and require confirmation in the list UI.

## New Count workflow

`/app/inventory-counts/new` first loads active locations and product types from the authenticated shop through the GraphQL Admin API. The employee selects a location and product-type scope and enters a trimmed, count-specific area and employee name. Preview reads Shopify without writing to PostgreSQL. Create revalidates the choices, fetches a fresh snapshot, creates the count as `COUNTING`, records `startedAt`, and redirects to `/app/inventory-counts/:countId/count`; browser-provided totals are never trusted.

Locations come from the paginated `locations` connection and inactive locations are excluded. Product types are derived from cursor-paginated active product variants. `__ALL__` represents all product types and `__UNCATEGORIZED__` represents a blank product type.

The scope includes only ACTIVE products, tracked inventory items, and variants with an inventory level at the selected location. Zero-on-hand variants and variants without a SKU or barcode remain in scope. DRAFT/ARCHIVED products, untracked items, and variants not stocked at the location are excluded.

Expected quantity comes only from the location inventory level's named `on_hand` quantity. A missing `on_hand` value fails the entire operation. Every line stores a frozen integer `startingQuantity`; later Shopify changes do not update it.

Count numbers are integers scoped by shop and displayed with three-digit padding. A serializable transaction calculates the next value and creates the count plus all lines atomically. The `[shop, countNumber]` unique constraint and retry handling make concurrent allocation safe and prevent reuse of historical numbers.

Before preview and creation, active DRAFT, COUNTING, and REVIEW counts are compared by shop, location, normalized (trimmed, case-insensitive) area, and intersecting product-type scope. `__ALL__` overlaps every scope. A warning names matches and creation requires explicit confirmation.

## Status workflow

All transitions are authenticated, scoped by count ID and shop, and guarded by the current database status. `COUNTING` can be saved to `DRAFT`, finished to `REVIEW`, or cancelled. `DRAFT` can continue to `COUNTING`. `REVIEW` can return to `COUNTING`, complete without Shopify changes, or be cancelled. `COMPLETED` and `CANCELLED` are terminal and read-only.

A line is unresolved only when it remains `UNCOUNTED`, has `countedQuantity` zero, has no `firstScannedAt`, and is not `committedUncounted`. Finishing with unresolved lines requires confirmation. Confirmed lines retain `UNCOUNTED`, zero quantity, and null scan timestamps while `committedUncounted = true` records the audit distinction. They count as resolved in progress without being represented as physical scans.

Cancellation requires a non-empty reason. The service preserves existing notes and appends `Cancellation reason:` plus the supplied text, then records `completedAt` and moves the count to `CANCELLED`.

## Manual counting and product search

Counting mode provides row-scoped decrease, direct-entry, and increase controls. Updates are saved immediately through React Router fetchers and server-side serializable transactions. Increment and decrement read the database quantity instead of trusting browser state. Quantities are PostgreSQL integers from 0 through 2,147,483,647; negative, blank, decimal, and out-of-range values are rejected.

The first manual edit sets `firstScannedAt`, every edit updates `lastScannedAt`, the line becomes `COUNTED`, and `committedUncounted` is cleared. A manual count of zero therefore has a first-count timestamp and `COUNTED` status, while a never-counted zero remains `UNCOUNTED` without a first-count timestamp.

Search count products filters only the count's frozen lines in the browser, case-insensitively across product title, variant title, SKU, and barcode. It does not query or modify Shopify.

Add Product performs separate Shopify Admin GraphQL searches for exact barcode, exact SKU, and product title, then merges and deduplicates results in that order with a 20-variant limit. Only active, tracked variants stocked at the count location with a named `on_hand` quantity are shown. The selected variant is fetched and validated again on Add. Its current `on_hand` becomes the frozen `startingQuantity`; zero is valid. Extra products may be outside the original product-type scope and do not change `InventoryCount.productTypes`.

`InventoryCount.createdBy` is currently assumed to be the employee making all manual edits and product additions. Separate editor audit records are not yet stored.

## Removing products

While a count is `COUNTING`, Remove Products enables a temporary client-side selection mode. Row checkboxes select individual frozen lines, and Select All affects only rows currently visible after the in-count search filter. Changing or clearing the search preserves selections for hidden rows. Cancellation clears the selection without changing PostgreSQL.

Removal requires confirmation and may include uncounted, counted, originally snapshotted, or manually added lines. The count must retain at least one line. The server verifies the authenticated shop, `COUNTING` status, and ownership of every submitted line ID before deleting only those `InventoryCountLine` records. React Router then revalidates the count so variant, expected, counted, variance, and visible-row totals recalculate from the remaining lines.

Removing a line never changes Shopify inventory, the Shopify product, the count number, or the stored original `productTypes` scope. Related `InventoryScanEvent` records are preserved because the line relation uses `onDelete: SetNull`; their `inventoryCountLineId` becomes null. Removed-line details are not yet copied into a dedicated removal audit table.

## Product table sorting

Counting and read-only product tables share client-side sorting for Product, Variant, SKU, Barcode, Expected, Counted, Variance, and Status. Headers cycle ascending, descending, then back to the original loader order; Reset Sort is also available while sorting is active. Text comparisons are case-insensitive, locale-aware, and numeric-aware. Blank text values appear after populated values ascending and before them descending. Expected, counted, and variance columns use numeric values.

Counting-mode search runs before sorting, so changing either control preserves the other. Clearing search retains the active sort. Removal selections remain keyed by line ID when rows reorder, and Select All continues to operate on all currently visible filtered rows.

## Current limitations

- Barcode scanner event integration is not implemented.
- Separate editor audit records are not implemented.
- Shopify inventory is never written.
- CSV export is not implemented.
