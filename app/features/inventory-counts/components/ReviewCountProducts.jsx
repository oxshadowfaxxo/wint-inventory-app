/* eslint-disable react/prop-types */
import { useMemo, useRef, useState } from "react";
import { CountLinesTable } from "./CountLinesTable";
import {
  defaultReviewFilters,
  filterReviewCountLines,
  isReviewConditionValid,
} from "../utils/review-count-filters";
import styles from "./review-count-filters.module.css";

const operators = {
  variance: [
    ["positive", "Positive"],
    ["negative", "Negative"],
    ["zero", "Zero"],
    ["gt", "Greater Than"],
    ["lt", "Less Than"],
  ],
  shopify: [
    ["eq", "Equal To"],
    ["gt", "Greater Than"],
    ["lt", "Less Than"],
  ],
  counted: [
    ["eq", "Equal To"],
    ["gt", "Greater Than"],
    ["lt", "Less Than"],
  ],
  status: [
    ["counted", "Counted"],
    ["uncounted", "Not Counted"],
  ],
};

function Select({ label, value, onChange, options, disabled = false }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ReviewCountProducts({ lines }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(defaultReviewFilters);
  const [applied, setApplied] = useState(defaultReviewFilters);
  const [error, setError] = useState("");
  const nextId = useRef(0);
  const visible = useMemo(
    () => filterReviewCountLines(lines, applied),
    [lines, applied],
  );

  function update(changes) {
    setDraft((current) => ({ ...current, ...changes }));
  }
  function updateCondition(id, changes) {
    setDraft((current) => ({
      ...current,
      conditions: current.conditions.map((condition) =>
        condition.id === id ? { ...condition, ...changes } : condition,
      ),
    }));
  }
  function apply(event) {
    event.preventDefault();
    if (!draft.conditions.every(isReviewConditionValid)) {
      setError("Enter a valid comparison value for each numeric filter.");
      return;
    }
    setError("");
    setApplied(draft);
  }
  function clear() {
    setDraft(defaultReviewFilters());
    setApplied(defaultReviewFilters());
    setError("");
  }

  return (
    <s-stack direction="block" gap="base">
      <s-button
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="review-count-filters"
        accessibilityLabel={open ? "Filters, expanded" : "Filters, collapsed"}
      >
        Filters {open ? "▲" : "▼"}
      </s-button>
      {open && (
        <form
          id="review-count-filters"
          className={styles.panel}
          onSubmit={apply}
          aria-label="Review count filters"
        >
          <div className={styles.row}>
            <Select
              label="Show Only"
              value={draft.showOnly}
              onChange={(showOnly) => update({ showOnly })}
              options={[
                ["all", "All Products"],
                ["variances", "Variances Only"],
                ["shortages", "Shortages Only"],
                ["overages", "Overages Only"],
                ["matches", "Matches Only"],
                ["uncounted", "Not Counted"],
              ]}
            />
          </div>
          <div className={styles.row}>
            <Select
              label="Sort By"
              value={draft.sort?.column || ""}
              onChange={(column) =>
                update({
                  sort: column
                    ? { column, direction: draft.sort?.direction || "asc" }
                    : null,
                })
              }
              options={[
                ["", "Original Order"],
                ["product", "Product Title"],
                ["sku", "SKU"],
                ["currentShopify", "Shopify Quantity"],
                ["counted", "Counted Quantity"],
                ["reviewVariance", "Quantity Variance"],
                ["absoluteVariance", "Absolute Variance"],
              ]}
            />
            <Select
              label="Sort Direction"
              value={draft.sort?.direction || "asc"}
              disabled={!draft.sort}
              onChange={(direction) =>
                update({ sort: { ...draft.sort, direction } })
              }
              options={[
                ["asc", "Ascending"],
                ["desc", "Descending"],
              ]}
            />
          </div>
          {draft.conditions.map((condition, index) => (
            <div className={styles.row} key={condition.id}>
              <Select
                label={`Filter ${index + 1}`}
                value={condition.field}
                onChange={(field) =>
                  updateCondition(condition.id, {
                    field,
                    operator: operators[field][0][0],
                    value: "",
                  })
                }
                options={[
                  ["variance", "Quantity Variance"],
                  ["shopify", "Shopify Quantity"],
                  ["counted", "Counted Quantity"],
                  ["status", "Count Status"],
                ]}
              />
              <Select
                label={`Condition ${index + 1}`}
                value={condition.operator}
                onChange={(operator) =>
                  updateCondition(condition.id, { operator })
                }
                options={operators[condition.field]}
              />
              {["eq", "gt", "lt"].includes(condition.operator) && (
                <label className={styles.field}>
                  <span>Comparison Value {index + 1}</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={condition.value}
                    onChange={(event) =>
                      updateCondition(condition.id, {
                        value: event.target.value,
                      })
                    }
                  />
                </label>
              )}
              <s-button
                type="button"
                accessibilityLabel={`Remove filter ${index + 1}`}
                onClick={() =>
                  update({
                    conditions: draft.conditions.filter(
                      ({ id }) => id !== condition.id,
                    ),
                  })
                }
              >
                Remove
              </s-button>
            </div>
          ))}
          <div>
            <s-button
              type="button"
              onClick={() =>
                update({
                  conditions: [
                    ...draft.conditions,
                    {
                      id: nextId.current++,
                      field: "variance",
                      operator: "positive",
                      value: "",
                    },
                  ],
                })
              }
            >
              + Add Filter
            </s-button>
          </div>
          <div className={styles.row}>
            <Select
              label="Match"
              value={draft.match}
              onChange={(match) => update({ match })}
              options={[
                ["all", "ALL (AND)"],
                ["any", "ANY (OR)"],
              ]}
            />
          </div>
          {error && <s-banner tone="critical">{error}</s-banner>}
          <div className={styles.row}>
            <s-button type="submit" variant="primary">
              Apply Filters
            </s-button>
            <s-button type="button" onClick={clear}>
              Clear All
            </s-button>
          </div>
        </form>
      )}
      <s-text>
        Shopify Quantity uses the current review snapshot. Quantity Variance is
        Counted minus Current Shopify; unknown quantities are excluded from
        numeric filters. Not Counted includes lines committed as uncounted.
      </s-text>
      <div role="status">
        Showing {visible.length} of {lines.length} products.
      </div>
      {visible.length ? (
        <CountLinesTable
          lines={visible}
          countStatus="REVIEW"
          sortingDisabled
          viewSort={applied.sort}
        />
      ) : (
        <s-paragraph>No products match the selected filters.</s-paragraph>
      )}
    </s-stack>
  );
}
