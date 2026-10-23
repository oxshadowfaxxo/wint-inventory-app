import { sortInventoryCountLines } from "./inventory-count-sort.js";

export function defaultReviewFilters() {
  // null preserves the loader's original order, matching the existing table.
  return { showOnly: "all", sort: null, match: "all", conditions: [] };
}

export function reviewVariance(line) {
  return line.reviewShopifyQuantity == null
    ? null
    : line.countedQuantity - line.reviewShopifyQuantity;
}

function matchesShowOnly(line, showOnly) {
  if (showOnly === "all") return true;
  if (showOnly === "uncounted") return line.status === "UNCOUNTED";
  const variance = reviewVariance(line);
  if (variance == null) return false;
  if (showOnly === "variances") return variance !== 0;
  if (showOnly === "shortages") return variance < 0;
  if (showOnly === "overages") return variance > 0;
  if (showOnly === "matches") return variance === 0;
  return false;
}

export function isReviewConditionValid(condition) {
  if (condition.field === "status")
    return ["counted", "uncounted"].includes(condition.operator);
  const operators =
    condition.field === "variance"
      ? ["positive", "negative", "zero", "gt", "lt"]
      : ["eq", "gt", "lt"];
  if (
    !["variance", "shopify", "counted"].includes(condition.field) ||
    !operators.includes(condition.operator)
  )
    return false;
  return (
    !["eq", "gt", "lt"].includes(condition.operator) ||
    (String(condition.value).trim() !== "" &&
      Number.isFinite(Number(condition.value)))
  );
}

function matchesCondition(line, condition) {
  if (!isReviewConditionValid(condition)) return false;
  if (condition.field === "status") {
    // Committing an untouched line does not change its UNCOUNTED status.
    return condition.operator === "uncounted"
      ? line.status === "UNCOUNTED"
      : line.status !== "UNCOUNTED";
  }
  const value =
    condition.field === "variance"
      ? reviewVariance(line)
      : condition.field === "shopify"
        ? line.reviewShopifyQuantity
        : line.countedQuantity;
  if (value == null) return false;
  if (condition.operator === "positive") return value > 0;
  if (condition.operator === "negative") return value < 0;
  if (condition.operator === "zero") return value === 0;
  const comparison = Number(condition.value);
  if (condition.operator === "eq") return value === comparison;
  if (condition.operator === "gt") return value > comparison;
  return value < comparison;
}

export function filterReviewCountLines(lines, filters) {
  const filtered = lines.filter((line) => {
    if (!matchesShowOnly(line, filters.showOnly)) return false;
    if (!filters.conditions.length) return true;
    return filters.match === "any"
      ? filters.conditions.some((condition) =>
          matchesCondition(line, condition),
        )
      : filters.conditions.every((condition) =>
          matchesCondition(line, condition),
        );
  });
  return sortInventoryCountLines(filtered, filters.sort);
}
