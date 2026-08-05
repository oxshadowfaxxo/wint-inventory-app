/* eslint-disable react/prop-types */

export function CountProgress({
  productsCounted,
  totalProducts,
  quantityCounted,
  totalQuantity,
}) {
  return (
    <s-stack direction="block" gap="small">
      <s-text>
        Products: {productsCounted} of {totalProducts}
      </s-text>
      <s-text>
        Quantity: {quantityCounted} of {totalQuantity}
      </s-text>
    </s-stack>
  );
}
