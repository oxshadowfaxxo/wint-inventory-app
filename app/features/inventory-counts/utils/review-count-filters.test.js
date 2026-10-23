import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultReviewFilters,
  filterReviewCountLines,
  isReviewConditionValid,
  reviewVariance,
} from "./review-count-filters.js";

const lines = [
  {
    id: "short",
    productTitle: "Beta",
    sku: "SKU10",
    countedQuantity: 2,
    reviewShopifyQuantity: 5,
    startingQuantity: 100,
    status: "COUNTED",
  },
  {
    id: "over",
    productTitle: "Alpha",
    sku: "SKU2",
    countedQuantity: 8,
    reviewShopifyQuantity: 5,
    startingQuantity: 0,
    status: "COUNTED",
  },
  {
    id: "match",
    productTitle: "Gamma",
    sku: "SKU1",
    countedQuantity: 5,
    reviewShopifyQuantity: 5,
    status: "COUNTED",
  },
  {
    id: "zero",
    productTitle: "Delta",
    sku: "SKU4",
    countedQuantity: 0,
    reviewShopifyQuantity: 0,
    status: "COUNTED",
  },
  {
    id: "untouched",
    productTitle: "Echo",
    sku: "SKU5",
    countedQuantity: 0,
    reviewShopifyQuantity: 7,
    status: "UNCOUNTED",
    committedUncounted: true,
  },
  {
    id: "unknown",
    productTitle: "Foxtrot",
    sku: null,
    countedQuantity: 1,
    reviewShopifyQuantity: null,
    status: "COUNTED",
  },
  {
    id: "negative",
    productTitle: "Golf",
    sku: "SKU7",
    countedQuantity: 1,
    reviewShopifyQuantity: -2,
    status: "RECOUNT",
  },
];
const ids = (settings = {}) =>
  filterReviewCountLines(lines, { ...defaultReviewFilters(), ...settings }).map(
    ({ id }) => id,
  );
const condition = (field, operator, value = "") => ({ field, operator, value });

test("Show Only uses existing review variance and UNCOUNTED status", () => {
  assert.deepEqual(
    ids(),
    lines.map(({ id }) => id),
  );
  assert.equal(reviewVariance(lines[0]), -3); // Refreshed Shopify, not starting quantity.
  assert.equal(reviewVariance(lines[5]), null);
  assert.deepEqual(ids({ showOnly: "variances" }), [
    "short",
    "over",
    "untouched",
    "negative",
  ]);
  assert.deepEqual(ids({ showOnly: "shortages" }), ["short", "untouched"]);
  assert.deepEqual(ids({ showOnly: "overages" }), ["over", "negative"]);
  assert.deepEqual(ids({ showOnly: "matches" }), ["match", "zero"]);
  assert.deepEqual(ids({ showOnly: "uncounted" }), ["untouched"]);
});

test("variance signs and strict numeric comparisons", () => {
  for (const [operator, value, expected] of [
    ["positive", "", ["over", "negative"]],
    ["negative", "", ["short", "untouched"]],
    ["zero", "", ["match", "zero"]],
    ["gt", "0", ["over", "negative"]],
    ["lt", "-3", ["untouched"]],
  ])
    assert.deepEqual(
      ids({ conditions: [condition("variance", operator, value)] }),
      expected,
    );
});

test("Shopify and counted quantity comparisons include zero and negative values", () => {
  assert.deepEqual(ids({ conditions: [condition("shopify", "eq", "0")] }), [
    "zero",
  ]);
  assert.deepEqual(ids({ conditions: [condition("shopify", "lt", "0")] }), [
    "negative",
  ]);
  assert.deepEqual(ids({ conditions: [condition("shopify", "gt", "5")] }), [
    "untouched",
  ]);
  assert.deepEqual(ids({ conditions: [condition("counted", "eq", "0")] }), [
    "zero",
    "untouched",
  ]);
  assert.deepEqual(ids({ conditions: [condition("counted", "gt", "2")] }), [
    "over",
    "match",
  ]);
  assert.deepEqual(ids({ conditions: [condition("counted", "lt", "1")] }), [
    "zero",
    "untouched",
  ]);
});

test("ALL and ANY apply only within the Show Only result set", () => {
  const conditions = [
    condition("variance", "positive"),
    condition("counted", "gt", "4"),
  ];
  assert.deepEqual(ids({ conditions }), ["over"]);
  assert.deepEqual(ids({ conditions, match: "any" }), [
    "over",
    "match",
    "negative",
  ]);
  assert.deepEqual(
    ids({ showOnly: "shortages", conditions, match: "any" }),
    [],
  );
  assert.deepEqual(ids({ showOnly: "overages", conditions, match: "any" }), [
    "over",
    "negative",
  ]);
  assert.deepEqual(ids({ match: "any", conditions: [] }), ids());
});

test("Count Status distinguishes untouched and explicitly counted zero quantities", () => {
  assert.deepEqual(ids({ conditions: [condition("status", "uncounted")] }), [
    "untouched",
  ]);
  assert.deepEqual(ids({ conditions: [condition("status", "counted")] }), [
    "short",
    "over",
    "match",
    "zero",
    "unknown",
    "negative",
  ]);
});

test("invalid comparisons cannot silently become a zero filter", () => {
  for (const value of ["", " ", "bad", "Infinity"]) {
    assert.equal(
      isReviewConditionValid(condition("shopify", "eq", value)),
      false,
    );
  }
  assert.equal(
    isReviewConditionValid(condition("variance", "gt", "-1.5")),
    true,
  );
  assert.equal(isReviewConditionValid(condition("vendor", "eq", "1")), false);
  assert.equal(isReviewConditionValid(condition("status", "unknown")), false);
});

test("all supported sorts reuse stable ordering and both directions", () => {
  for (const column of [
    "product",
    "sku",
    "currentShopify",
    "counted",
    "reviewVariance",
    "absoluteVariance",
  ]) {
    const asc = ids({ sort: { column, direction: "asc" } });
    const desc = ids({ sort: { column, direction: "desc" } });
    assert.equal(asc.length, lines.length);
    assert.equal(desc.length, lines.length);
  }
  assert.deepEqual(ids({ sort: { column: "product", direction: "asc" } }), [
    "over",
    "short",
    "zero",
    "untouched",
    "unknown",
    "match",
    "negative",
  ]);
  assert.deepEqual(ids({ sort: { column: "sku", direction: "asc" } }), [
    "match",
    "over",
    "zero",
    "untouched",
    "negative",
    "short",
    "unknown",
  ]);
  assert.deepEqual(
    ids({ sort: { column: "reviewVariance", direction: "asc" } }),
    ["untouched", "short", "match", "zero", "over", "negative", "unknown"],
  );
  assert.deepEqual(
    ids({ sort: { column: "reviewVariance", direction: "desc" } }),
    ["unknown", "over", "negative", "match", "zero", "short", "untouched"],
  );
  assert.deepEqual(
    ids({ sort: { column: "absoluteVariance", direction: "asc" } }),
    ["match", "zero", "short", "over", "negative", "untouched", "unknown"],
  );
  assert.deepEqual(
    ids({ sort: { column: "absoluteVariance", direction: "desc" } }),
    ["unknown", "untouched", "short", "over", "negative", "match", "zero"],
  );
});

test("filtering never mutates the source data; reset returns original order", () => {
  const original = structuredClone(lines);
  const frozen = Object.freeze(lines.map((line) => Object.freeze({ ...line })));
  filterReviewCountLines(frozen, {
    ...defaultReviewFilters(),
    showOnly: "variances",
    sort: { column: "absoluteVariance", direction: "desc" },
  });
  assert.deepEqual(lines, original);
  assert.deepEqual(
    ids(defaultReviewFilters()),
    original.map(({ id }) => id),
  );
  const firstVisit = defaultReviewFilters();
  firstVisit.conditions.push(condition("variance", "positive"));
  assert.deepEqual(defaultReviewFilters().conditions, []);
});
