/* eslint-disable react/prop-types */
function typeLabel(types) {
  return types.includes("__ALL__")
    ? "All product types"
    : types.map((type) => type === "__UNCATEGORIZED__" ? "Uncategorized" : type).join(", ");
}

export function CountScopePreview({ preview, error }) {
  const { configuration, summary, overlaps } = preview;
  return (
    <s-section heading="Preview count">
      <s-stack direction="block" gap="base">
        {error && <s-banner tone="critical">{error}</s-banner>}
        <s-text>Location: {configuration.locationName}</s-text>
        <s-text>Area: {configuration.area}</s-text>
        <s-text>Employee: {configuration.employee}</s-text>
        <s-text>Product types: {typeLabel(configuration.productTypes)}</s-text>
        <s-text>Total variants to count: {summary.totalVariants}</s-text>
        <s-text>Total expected on-hand quantity: {summary.totalExpectedQuantity}</s-text>
        <s-text>Zero-quantity variants: {summary.zeroQuantityVariants}</s-text>
        <s-text>Variants without barcodes: {summary.withoutBarcodes}</s-text>
        <s-text>Variants without SKUs: {summary.withoutSkus}</s-text>
        {overlaps.length > 0 && (
          <s-banner tone="warning">
            This scope overlaps {overlaps.map((count) => count.name).join(", ")}.
          </s-banner>
        )}
      </s-stack>
    </s-section>
  );
}
