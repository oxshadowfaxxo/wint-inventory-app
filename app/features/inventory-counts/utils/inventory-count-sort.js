const textFields = {
  product: (line) => line.productTitle,
  variant: (line) => line.variantTitle,
  sku: (line) => line.sku,
  barcode: (line) => line.barcode,
  status: (line) => line.status,
};

const numericFields = {
  expected: (line) => line.startingQuantity ?? 0,
  counted: (line) => line.countedQuantity,
  variance: (line) => line.countedQuantity - (line.startingQuantity ?? 0),
};

function compareText(left, right) {
  const leftBlank = left == null || String(left).trim() === "";
  const rightBlank = right == null || String(right).trim() === "";
  if (leftBlank || rightBlank) {
    if (leftBlank && rightBlank) return 0;
    const blankOrder = leftBlank ? 1 : -1;
    return blankOrder;
  }
  return String(left).localeCompare(String(right), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function sortInventoryCountLines(lines, sort) {
  if (!sort) return lines;
  const textValue = textFields[sort.column];
  const numericValue = numericFields[sort.column];
  return lines
    .map((line, index) => ({ line, index }))
    .sort((left, right) => {
      const comparison = textValue
        ? compareText(textValue(left.line), textValue(right.line))
        : numericValue(left.line) - numericValue(right.line);
      const directed = sort.direction === "asc" ? comparison : -comparison;
      return directed || left.index - right.index;
    })
    .map(({ line }) => line);
}
