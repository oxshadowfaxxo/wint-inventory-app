/* eslint-disable react/prop-types */

export function ProductTitleLink({ productId, productTitle }) {
  // Keep IDs as strings: Shopify IDs can exceed JavaScript's safe integer range.
  const id = typeof productId === "string"
    ? /^(?:gid:\/\/shopify\/Product\/)?([1-9]\d*)$/.exec(productId)?.[1]
    : null;

  if (!id) return productTitle;

  return (
    <s-link href={`shopify:admin/products/${id}`}>
      {productTitle}
    </s-link>
  );
}
