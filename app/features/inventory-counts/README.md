# Inventory counts

The authenticated inventory-count feature provides the list, two-step New Count workflow, dedicated counting mode, and read-only detail preview.

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

## Current limitations

- Barcode counting is not implemented.
- Shopify inventory is never written.
- CSV export is not implemented.
- Counting quantities and barcode scanning are not implemented; counting mode is currently read-only.
