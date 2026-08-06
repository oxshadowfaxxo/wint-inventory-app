export const ALL_PRODUCT_TYPES = "__ALL__";
export const UNCATEGORIZED_PRODUCT_TYPE = "__UNCATEGORIZED__";

async function graphql(admin, query, variables) {
  const response = await admin.graphql(query, { variables });
  const body = await response.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((error) => error.message).join("; "));
  }
  return body.data;
}

export async function getActiveLocations(admin) {
  const locations = [];
  let after = null;
  do {
    const data = await graphql(
      admin,
      `#graphql
        query InventoryCountLocations($after: String) {
          locations(first: 100, after: $after, query: "active:true") {
            nodes { id name isActive }
            pageInfo { hasNextPage endCursor }
          }
        }`,
      { after },
    );
    locations.push(...data.locations.nodes.filter((location) => location.isActive));
    after = data.locations.pageInfo.hasNextPage
      ? data.locations.pageInfo.endCursor
      : null;
  } while (after);
  return locations;
}

async function getActiveVariantNodes(admin) {
  const variants = [];
  let after = null;
  do {
    const data = await graphql(
      admin,
      `#graphql
        query InventoryCountVariants($after: String) {
          productVariants(first: 100, after: $after, query: "product_status:active") {
            nodes {
              id title sku barcode
              product { id title status productType vendor }
              inventoryItem { id tracked }
            }
            pageInfo { hasNextPage endCursor }
          }
        }`,
      { after },
    );
    variants.push(...data.productVariants.nodes);
    after = data.productVariants.pageInfo.hasNextPage
      ? data.productVariants.pageInfo.endCursor
      : null;
  } while (after);
  return variants;
}

export async function getProductTypes(admin) {
  const variants = await getActiveVariantNodes(admin);
  const types = new Set();
  let hasUncategorized = false;
  for (const variant of variants) {
    const value = variant.product.productType?.trim();
    if (value) types.add(value);
    else hasUncategorized = true;
  }
  return {
    productTypes: [...types].sort((a, b) => a.localeCompare(b)),
    hasUncategorized,
  };
}

function selectedTypeMatches(productType, selectedTypes) {
  if (selectedTypes.includes(ALL_PRODUCT_TYPES)) return true;
  const normalized = productType?.trim();
  if (!normalized) return selectedTypes.includes(UNCATEGORIZED_PRODUCT_TYPE);
  return selectedTypes.includes(normalized);
}

const INVENTORY_SNAPSHOT_QUERY = `#graphql
  query InventorySnapshot($cursor: String, $locationId: ID!) {
    productVariants(
      first: 100
      after: $cursor
      query: "product_status:active"
    ) {
      nodes {
        id
        title
        sku
        barcode
        product {
          id
          title
          status
          productType
          vendor
        }
        inventoryItem {
          id
          tracked
          inventoryLevel(locationId: $locationId) {
            location {
              id
              name
            }
            quantities(names: ["on_hand"]) {
              name
              quantity
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export async function getInventorySnapshot(admin, locationId, selectedTypes) {
  const lines = [];
  const missingQuantities = [];
  let cursor = null;

  do {
    const data = await graphql(
      admin,
      INVENTORY_SNAPSHOT_QUERY,
      { cursor, locationId },
    );

    for (const variant of data.productVariants.nodes) {
      if (
        variant.product.status !== "ACTIVE" ||
        !variant.inventoryItem?.tracked ||
        !selectedTypeMatches(variant.product.productType, selectedTypes)
      ) {
        continue;
      }

      const inventoryLevel = variant.inventoryItem.inventoryLevel;
      if (!inventoryLevel) continue;

      const onHandEntry = inventoryLevel.quantities?.find(
        (entry) => entry.name === "on_hand",
      );
      const onHandQuantity = onHandEntry?.quantity;
      if (!Number.isInteger(onHandQuantity)) {
        missingQuantities.push(`${variant.product.title} — ${variant.title}`);
        continue;
      }

      lines.push({
        inventoryItemId: variant.inventoryItem.id,
        productId: variant.product.id,
        variantId: variant.id,
        productTitle: variant.product.title,
        variantTitle: variant.title || null,
        vendor: variant.product.vendor || null,
        productType: variant.product.productType?.trim() || null,
        sku: variant.sku?.trim() || null,
        barcode: variant.barcode?.trim() || null,
        startingQuantity: onHandQuantity,
        countedQuantity: 0,
        status: "UNCOUNTED",
        firstScannedAt: null,
        lastScannedAt: null,
      });
    }

    cursor = data.productVariants.pageInfo.hasNextPage
      ? data.productVariants.pageInfo.endCursor
      : null;
  } while (cursor);

  if (missingQuantities.length) {
    const error = new Error(`Missing on_hand for: ${missingQuantities.join(", ")}`);
    error.code = "MISSING_ON_HAND";
    throw error;
  }
  return lines;
}

export function summarizeSnapshot(lines) {
  return {
    totalVariants: lines.length,
    totalExpectedQuantity: lines.reduce((sum, line) => sum + line.startingQuantity, 0),
    zeroQuantityVariants: lines.filter((line) => line.startingQuantity === 0).length,
    withoutBarcodes: lines.filter((line) => !line.barcode).length,
    withoutSkus: lines.filter((line) => !line.sku).length,
  };
}
