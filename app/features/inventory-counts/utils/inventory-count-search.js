function normalized(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase();
}

export function exactBarcodeMatches(lines, query) {
  const needle = String(query ?? "").trim();
  if (!needle) return [];
  return lines.filter((line) => String(line.barcode ?? "") === needle);
}

export function searchInventoryCountLines(lines, query) {
  const needle = normalized(query);
  if (!needle) return [];

  return lines
    .map((line, originalIndex) => {
      const barcode = normalized(line.barcode);
      const sku = normalized(line.sku);
      const product = normalized(line.productTitle);
      const variant = normalized(line.variantTitle);
      let rank = null;
      if (barcode === needle) rank = 0;
      else if (sku === needle) rank = 1;
      else if (barcode.includes(needle)) rank = 2;
      else if (sku.includes(needle)) rank = 3;
      else if (product.includes(needle)) rank = 4;
      else if (variant.includes(needle)) rank = 5;
      return rank === null ? null : { line, rank, originalIndex };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.rank - right.rank || left.originalIndex - right.originalIndex,
    )
    .map(({ line }) => line);
}
