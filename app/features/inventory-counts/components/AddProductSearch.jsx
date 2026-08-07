/* eslint-disable react/prop-types */
import { useState } from "react";
import { useFetcher } from "react-router";

function AddProductResult({ countId, result, alreadyInCount }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  const added = fetcher.data?.added === true;
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small">
        <s-heading>{result.productTitle}</s-heading>
        <s-text>Variant: {result.variantTitle || "—"}</s-text>
        <s-text>
          SKU: {result.sku || "—"} · Barcode: {result.barcode || "—"}
        </s-text>
        <s-text>Product type: {result.productType || "Uncategorized"}</s-text>
        <s-text>Current on-hand: {result.startingQuantity}</s-text>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="add-product" />
          <input type="hidden" name="countId" value={countId} />
          <input type="hidden" name="variantId" value={result.variantId} />
          <s-button type="submit" disabled={busy || alreadyInCount || added}>
            {alreadyInCount || added ? "Already in count" : "Add"}
          </s-button>
        </fetcher.Form>
        {fetcher.data?.error && (
          <s-text tone="critical">{fetcher.data.error}</s-text>
        )}
      </s-stack>
    </s-box>
  );
}

export function AddProductSearch({ countId, existingVariantIds }) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();
  const results = fetcher.data?.results || [];
  return (
    <div id="add-product">
      <s-section heading="Add Product">
        <s-button onClick={() => setOpen((value) => !value)}>
          {open ? "Close Add Product" : "Add Product"}
        </s-button>
        {open && (
          <div style={{ marginTop: 16 }}>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="search-shopify" />
              <input type="hidden" name="countId" value={countId} />
              <label style={{ display: "grid", gap: 6, maxWidth: 560 }}>
                <strong>Search Shopify products</strong>
                <input
                  name="search"
                  placeholder="Search by barcode, SKU, or product title"
                  required
                />
              </label>
              <div style={{ marginTop: 12 }}>
                <s-button type="submit" disabled={fetcher.state !== "idle"}>
                  Search Shopify
                </s-button>
              </div>
            </fetcher.Form>
            {fetcher.data?.error && (
              <s-banner tone="critical">{fetcher.data.error}</s-banner>
            )}
            {fetcher.data?.searched &&
              results.length === 0 &&
              !fetcher.data?.error && (
                <s-paragraph>
                  No Shopify products matched your search.
                </s-paragraph>
              )}
            {results.length > 0 && (
              <s-stack direction="block" gap="base">
                {results.map((result) => (
                  <AddProductResult
                    key={result.variantId}
                    countId={countId}
                    result={result}
                    alreadyInCount={existingVariantIds.includes(
                      result.variantId,
                    )}
                  />
                ))}
              </s-stack>
            )}
          </div>
        )}
      </s-section>
    </div>
  );
}
