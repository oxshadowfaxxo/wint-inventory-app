# Inventory counts

This feature provides inventory count list and placeholder detail pages for reviewing active and historical counts. Routes authenticate the Shopify admin request, scope database reads to the authenticated shop, and delegate querying, calculations, and presentation to feature modules.

## Folder structure

- `components/` contains the compact current count row, history row, detail product-lines table, and reusable progress display.
- `services/` contains the server-only Prisma query.
- `utils/` contains progress, variance, and last-activity calculations.
- `app/routes/app.inventory-counts.jsx` is the thin route and loader integration.
- `app/routes/app.inventory-counts.$countId.jsx` provides the placeholder count detail page and a friendly not-found state.

## Status rules

Current counts have a status of `DRAFT`, `COUNTING`, or `REVIEW`. History contains `COMPLETED` and `CANCELLED` counts.

## Progress calculations

A product is counted when its line has a positive `countedQuantity`, a non-null `firstScannedAt`, or a status of `COUNTED`, `RECOUNT`, `APPROVED`, or `EXCLUDED`. Products counted is the number of matching lines; total products is every line in the count.

Quantity counted is the sum of `countedQuantity`. Total quantity is the sum of `startingQuantity`, with null values treated as zero. A zero-inventory variant still contributes one to total products but contributes zero to total quantity.

## Current limitations

- Search is inactive.
- New Count is inactive.
- Detail pages are read-only previews with count totals, product-line variances, and read-only notes at the bottom.
- Continue Counting will eventually open a separate editable counting workflow. It remains inactive until that route exists.
- Completed and cancelled counts remain permanently read-only.
- CSV export is not yet implemented, so Export CSV remains inactive.
- CSV export is not implemented.
- Shopify inventory sync is not implemented.
