/* eslint-disable react/prop-types */

import styles from "./count-lines-table.module.css";
import { SortableTableHeader } from "./SortableTableHeader";
import { useInventoryCountSort } from "../hooks/useInventoryCountSort";

function formatVariance(countedQuantity, startingQuantity) {
  const variance = countedQuantity - (startingQuantity ?? 0);

  return variance > 0 ? `+${variance}` : String(variance);
}

function formatSigned(value) {
  if (value == null) return "—";
  return value > 0 ? `+${value}` : String(value);
}

export function CountLinesTable({ lines, countStatus }) {
  const isReview = countStatus === "REVIEW";
  const { sort, sortedLines, toggleSort, resetSort } = useInventoryCountSort(lines);
  return (
    <s-stack direction="block" gap="base">
      {sort && <s-button onClick={resetSort}>Reset Sort</s-button>}
      <div className={styles.container}>
        <table className={`${styles.table} ${isReview ? styles.reviewTable : ""}`}>
          <thead>
            <tr>
              <SortableTableHeader column="product" label="Product" sort={sort} onSort={toggleSort} />
              <SortableTableHeader column="variant" label="Variant" sort={sort} onSort={toggleSort} />
              <SortableTableHeader column="sku" label="SKU" sort={sort} onSort={toggleSort} />
              <SortableTableHeader column="barcode" label="Barcode" sort={sort} onSort={toggleSort} />
              <SortableTableHeader column="expected" label={isReview ? "Starting" : "Expected"} sort={sort} onSort={toggleSort} className={styles.number} />
              <SortableTableHeader column="counted" label="Counted" sort={sort} onSort={toggleSort} className={styles.number} />
              {isReview ? (
                <>
                  <SortableTableHeader column="currentShopify" label="Current Shopify" sort={sort} onSort={toggleSort} className={styles.number} />
                  <SortableTableHeader column="shopifyChange" label="Shopify Change" sort={sort} onSort={toggleSort} className={styles.number} />
                  <SortableTableHeader column="reviewVariance" label="Review Variance" sort={sort} onSort={toggleSort} className={styles.number} />
                </>
              ) : (
                <SortableTableHeader column="variance" label="Variance" sort={sort} onSort={toggleSort} className={styles.number} />
              )}
              <SortableTableHeader column="status" label="Status" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
          {sortedLines.map((line) => (
            <tr key={line.id}>
              <td className={styles.product}>{line.productTitle}</td>
              <td>{line.variantTitle || "—"}</td>
              <td>{line.sku || "—"}</td>
              <td>{line.barcode || "—"}</td>
              <td className={styles.number}>{line.startingQuantity ?? (isReview ? "—" : 0)}</td>
              <td className={styles.number}>{line.countedQuantity}</td>
              {isReview ? (
                <>
                  <td className={styles.number}>{line.reviewShopifyQuantity ?? "—"}</td>
                  <td className={styles.number}>
                    {formatSigned(
                      line.reviewShopifyQuantity == null || line.startingQuantity == null
                        ? null
                        : line.reviewShopifyQuantity - line.startingQuantity,
                    )}
                  </td>
                  <td className={styles.number}>
                    {formatSigned(
                      line.reviewShopifyQuantity == null
                        ? null
                        : line.countedQuantity - line.reviewShopifyQuantity,
                    )}
                  </td>
                </>
              ) : (
                <td className={styles.number}>
                  {formatVariance(line.countedQuantity, line.startingQuantity)}
                </td>
              )}
              <td>
                <s-stack direction="block" gap="small">
                  <s-badge>{line.status}</s-badge>
                  {line.committedUncounted && (
                    <s-badge tone="attention">Committed as uncounted</s-badge>
                  )}
                </s-stack>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </s-stack>
  );
}
