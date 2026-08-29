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

const CURRENT_INVENTORY_QUANTITIES_QUERY = `#graphql
  query CurrentInventoryQuantities($ids: [ID!]!, $locationId: ID!) {
    nodes(ids: $ids) {
      ... on InventoryItem {
        id
        tracked
        inventoryLevel(locationId: $locationId) {
          quantities(names: ["on_hand"]) {
            name
            quantity
          }
        }
      }
    }
  }
`;

const INVENTORY_ITEM_BATCH_SIZE = 250;

export async function getCurrentInventoryQuantities(
  admin,
  locationId,
  inventoryItemIds,
) {
  const uniqueIds = [...new Set(inventoryItemIds.filter(Boolean))];
  const quantities = Object.fromEntries(uniqueIds.map((id) => [id, null]));

  for (let index = 0; index < uniqueIds.length; index += INVENTORY_ITEM_BATCH_SIZE) {
    const ids = uniqueIds.slice(index, index + INVENTORY_ITEM_BATCH_SIZE);
    const data = await graphql(admin, CURRENT_INVENTORY_QUANTITIES_QUERY, {
      ids,
      locationId,
    });
    for (const item of data.nodes) {
      if (!item?.id || !item.tracked || !item.inventoryLevel) continue;
      const onHand = item.inventoryLevel.quantities?.find(
        (quantity) => quantity.name === "on_hand",
      )?.quantity;
      if (Number.isInteger(onHand)) quantities[item.id] = onHand;
    }
  }

  return quantities;
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

const ADD_PRODUCT_VARIANTS_QUERY = `#graphql
  query AddProductVariants($query: String!, $locationId: ID!) {
    productVariants(first: 20, query: $query) {
      nodes {
        id
        title
        sku
        barcode
        product { id title productType vendor status }
        inventoryItem {
          id
          tracked
          inventoryLevel(locationId: $locationId) {
            quantities(names: ["on_hand"]) { name quantity }
          }
        }
      }
    }
  }
`;

const ADD_PRODUCT_VARIANT_QUERY = `#graphql
  query AddProductVariant($variantId: ID!, $locationId: ID!) {
    productVariant(id: $variantId) {
      id
      title
      sku
      barcode
      product { id title productType vendor status }
      inventoryItem {
        id
        tracked
        inventoryLevel(locationId: $locationId) {
          quantities(names: ["on_hand"]) { name quantity }
        }
      }
    }
  }
`;

const EXACT_BARCODE_VARIANTS_QUERY = `#graphql
  query ExactBarcodeVariants($query: String!, $locationId: ID!) {
    productVariants(first: 20, query: $query) {
      nodes {
        id title sku barcode
        product { id title productType vendor status }
        inventoryItem {
          id tracked
          inventoryLevel(locationId: $locationId) {
            quantities(names: ["on_hand"]) { name quantity }
          }
        }
      }
    }
  }
`;

function quoteSearchValue(value) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function normalizeAddProductVariant(variant) {
  const inventoryLevel = variant.inventoryItem?.inventoryLevel;
  const onHandEntry = inventoryLevel?.quantities?.find(
    (entry) => entry.name === "on_hand",
  );
  if (
    variant.product.status !== "ACTIVE" ||
    !variant.inventoryItem?.tracked ||
    !inventoryLevel ||
    !Number.isInteger(onHandEntry?.quantity)
  ) {
    return null;
  }
  return {
    inventoryItemId: variant.inventoryItem.id,
    productId: variant.product.id,
    variantId: variant.id,
    productTitle: variant.product.title,
    variantTitle: variant.title || null,
    vendor: variant.product.vendor || null,
    productType: variant.product.productType?.trim() || null,
    sku: variant.sku?.trim() || null,
    barcode: variant.barcode?.trim() || null,
    startingQuantity: onHandEntry.quantity,
  };
}

async function searchVariants(admin, locationId, searchQuery) {
  const data = await graphql(admin, ADD_PRODUCT_VARIANTS_QUERY, {
    query: searchQuery,
    locationId,
  });
  return data.productVariants.nodes;
}

export async function searchShopifyVariants(admin, locationId, rawSearch) {
  const search = rawSearch.trim();
  if (!search) return [];
  const quoted = quoteSearchValue(search);
  const queries = [
    `product_status:active AND barcode:${quoted}`,
    `product_status:active AND sku:${quoted}`,
  ];
  if (search.length >= 2) {
    queries.push(`product_status:active AND title:${quoted}*`);
  }
  const groups = await Promise.all(
    queries.map((query) => searchVariants(admin, locationId, query)),
  );
  const results = [];
  const seen = new Set();
  for (const group of groups) {
    for (const variant of group) {
      if (seen.has(variant.id)) continue;
      const normalized = normalizeAddProductVariant(variant);
      if (!normalized) continue;
      seen.add(variant.id);
      results.push(normalized);
      if (results.length === 20) return results;
    }
  }
  return results;
}

export async function getShopifyVariantForAddition(admin, locationId, variantId) {
  const data = await graphql(admin, ADD_PRODUCT_VARIANT_QUERY, {
    variantId,
    locationId,
  });
  const variant = data.productVariant;
  if (!variant || variant.product.status !== "ACTIVE") {
    const error = new Error("Product is no longer active.");
    error.userMessage = "Product is no longer active.";
    throw error;
  }
  if (!variant.inventoryItem?.tracked) {
    const error = new Error("Inventory tracking is disabled.");
    error.userMessage = "Inventory tracking is not enabled for this product.";
    throw error;
  }
  if (!variant.inventoryItem.inventoryLevel) {
    const error = new Error("Variant is not stocked at the count location.");
    error.userMessage = "Product is not stocked at this location.";
    throw error;
  }
  const normalized = normalizeAddProductVariant(variant);
  if (!normalized) {
    const error = new Error("Missing Shopify on_hand quantity.");
    error.userMessage = "Shopify on-hand quantity could not be loaded.";
    throw error;
  }
  return normalized;
}

function barcodeLookupError(message, code, details) {
  const error = new Error(message);
  error.userMessage = message;
  error.code = code;
  if (details) error.details = details;
  return error;
}

export async function getShopifyVariantByExactBarcode(admin, locationId, rawBarcode) {
  const barcode = String(rawBarcode ?? "").trim();
  const data = await graphql(admin, EXACT_BARCODE_VARIANTS_QUERY, {
    query: `barcode:${quoteSearchValue(barcode)}`,
    locationId,
  });
  const matches = data.productVariants.nodes.filter(
    (variant) => variant.barcode?.trim() === barcode,
  );
  if (matches.length === 0) {
    throw barcodeLookupError("Barcode not found in Shopify.", "SHOPIFY_BARCODE_NOT_FOUND");
  }
  if (matches.length > 1) {
    throw barcodeLookupError(
      "Multiple Shopify variants use this barcode.",
      "DUPLICATE_SHOPIFY_BARCODE",
      matches.map((variant) => ({
        productTitle: variant.product.title,
        variantTitle: variant.title || null,
        sku: variant.sku?.trim() || null,
      })),
    );
  }
  const variant = matches[0];
  if (variant.product.status !== "ACTIVE") {
    throw barcodeLookupError("Product is not active in Shopify.", "INACTIVE_PRODUCT");
  }
  if (!variant.inventoryItem?.tracked) {
    throw barcodeLookupError(
      "Inventory tracking is not enabled for this product.",
      "INVENTORY_NOT_TRACKED",
    );
  }
  if (!variant.inventoryItem.inventoryLevel) {
    throw barcodeLookupError(
      "This product is not stocked at the selected location.",
      "NOT_STOCKED_AT_LOCATION",
    );
  }
  const onHand = variant.inventoryItem.inventoryLevel.quantities?.find(
    (quantity) => quantity.name === "on_hand",
  )?.quantity;
  if (!Number.isInteger(onHand)) {
    throw barcodeLookupError(
      "Shopify on-hand quantity could not be loaded for this product.",
      "MISSING_ON_HAND",
    );
  }
  return {
    inventoryItemId: variant.inventoryItem.id,
    productId: variant.product.id,
    variantId: variant.id,
    productTitle: variant.product.title,
    variantTitle: variant.title || null,
    vendor: variant.product.vendor || null,
    productType: variant.product.productType?.trim() || null,
    sku: variant.sku?.trim() || null,
    barcode,
    startingQuantity: onHand,
  };
}
