const COUNTED_LINE_STATUSES = new Set([
  "COUNTED",
  "RECOUNT",
  "APPROVED",
  "EXCLUDED",
]);

/**
 * A variant is counted after a positive count, its first scan, or a workflow
 * status that indicates the line has already been handled. Every line remains
 * in totalProducts, including variants whose starting quantity is zero.
 */
export function calculateCountProgress(lines) {
  return lines.reduce(
    (progress, line) => {
      progress.totalProducts += 1;
      progress.totalQuantity += line.startingQuantity ?? 0;
      progress.quantityCounted += line.countedQuantity;

      if (
        line.countedQuantity > 0 ||
        line.firstScannedAt !== null ||
        COUNTED_LINE_STATUSES.has(line.status)
      ) {
        progress.productsCounted += 1;
      }

      return progress;
    },
    {
      productsCounted: 0,
      totalProducts: 0,
      quantityCounted: 0,
      totalQuantity: 0,
    },
  );
}

export function calculateVariance(quantityCounted, totalQuantity) {
  return quantityCounted - totalQuantity;
}

export function getLastActivity(count) {
  const timestamps = [
    count.updatedAt,
    ...count.lines.map((line) => line.lastScannedAt),
    ...count.scanEvents.map((event) => event.scannedAt),
  ].filter(Boolean);

  return new Date(
    Math.max(...timestamps.map((timestamp) => new Date(timestamp).getTime())),
  );
}
