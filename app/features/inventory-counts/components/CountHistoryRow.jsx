/* eslint-disable react/prop-types */

import { formatInventoryCountNumber } from "../utils/inventory-count-number";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

function formatCountName(count) {
  if (Number.isInteger(count.countNumber)) {
    return `Count: ${formatInventoryCountNumber(count.countNumber)}`;
  }
  const numericName = count.name.match(/\d+/)?.[0];

  if (numericName) {
    return `Count: ${numericName.padStart(3, "0")}`;
  }

  const idNumber = [...count.id].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 1000,
    0,
  );

  return `Count: ${String(idNumber).padStart(3, "0")}`;
}

function formatVariance(variance) {
  return variance > 0 ? `+${variance}` : String(variance);
}

export function CountHistoryRow({ count }) {
  return (
    <s-link
      href={`/app/inventory-counts/${count.id}`}
      aria-label={`Open ${formatCountName(count)} at ${count.locationName}`}
    >
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <s-heading>{formatCountName(count)}</s-heading>
            <s-badge>{count.status}</s-badge>
            <s-badge>{count.countType === "BLANK_SCAN" ? "Blank Scan" : "Product Type"}</s-badge>
          </s-stack>
          <s-stack direction="inline" gap="large">
            <s-text>Location: {count.locationName}</s-text>
            <s-text>
              Completed:{" "}
              {count.completedAt
                ? dateFormatter.format(new Date(count.completedAt))
                : "Not completed"}
            </s-text>
            <s-text>Completed by: {count.createdBy || "Not recorded"}</s-text>
          </s-stack>
          <s-stack direction="inline" gap="large">
            <s-text>
              {count.countType === "BLANK_SCAN" ? `Unique variants: ${count.progress.totalProducts}` : `Products: ${count.progress.productsCounted} of ${count.progress.totalProducts}`}
            </s-text>
            <s-text>Expected quantity: {count.progress.totalQuantity}</s-text>
            <s-text>
              Final counted quantity: {count.progress.quantityCounted}
            </s-text>
            <s-text>Total variance: {formatVariance(count.variance)}</s-text>
          </s-stack>
        </s-stack>
      </s-box>
    </s-link>
  );
}
