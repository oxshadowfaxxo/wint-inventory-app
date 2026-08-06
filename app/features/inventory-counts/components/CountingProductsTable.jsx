/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { QuantityControl } from "./QuantityControl";
import { SortableTableHeader } from "./SortableTableHeader";
import { useInventoryCountSort } from "../hooks/useInventoryCountSort";
import styles from "./count-lines-table.module.css";

function variance(line) {
  const value = line.countedQuantity - (line.startingQuantity ?? 0);
  return value > 0 ? `+${value}` : String(value);
}

function SelectAllCheckbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label="Select all visible products"
    />
  );
}

export function CountingProductsTable({ countId, lines }) {
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return lines;
    return lines.filter((line) =>
      [line.productTitle, line.variantTitle, line.sku, line.barcode]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(needle)),
    );
  }, [lines, search]);
  const { sort, sortedLines, toggleSort, resetSort } = useInventoryCountSort(filtered);
  const selectedLines = useMemo(
    () => lines.filter((line) => selectedIds.has(line.id)),
    [lines, selectedIds],
  );
  const visibleSelectedCount = sortedLines.filter((line) => selectedIds.has(line.id)).length;
  const allVisibleSelected = sortedLines.length > 0 && visibleSelectedCount === sortedLines.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;
  const wouldRemoveEveryLine = selectedIds.size >= lines.length;
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.removedCount) {
      setSelectedIds(new Set());
      setSelectionMode(false);
      setConfirming(false);
    }
  }, [fetcher.data]);

  function toggleLine(lineId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) sortedLines.forEach((line) => next.delete(line.id));
      else sortedLines.forEach((line) => next.add(line.id));
      return next;
    });
  }

  function cancelSelection() {
    setSelectedIds(new Set());
    setSelectionMode(false);
    setConfirming(false);
  }

  return (
    <s-stack direction="block" gap="base">
      <label style={{ display: "grid", gap: 6, maxWidth: 480 }}>
        <strong>Search count products</strong>
        <input
          type="search"
          placeholder="Search count products"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {!selectionMode ? (
        <s-button onClick={() => setSelectionMode(true)}>Remove Products</s-button>
      ) : (
        <s-stack direction="inline" gap="base">
          <s-button
            tone="critical"
            disabled={selectedIds.size === 0}
            onClick={() => setConfirming(true)}
          >
            Remove Selected
          </s-button>
          <s-button onClick={cancelSelection}>Cancel Selection</s-button>
          <s-text>{selectedIds.size} {selectedIds.size === 1 ? "product" : "products"} selected</s-text>
        </s-stack>
      )}

      {fetcher.data?.message && <s-banner tone="success">{fetcher.data.message}</s-banner>}
      {fetcher.data?.error && <s-banner tone="critical">{fetcher.data.error}</s-banner>}

      {confirming && (
        <s-section heading={`Remove ${selectedIds.size} ${selectedIds.size === 1 ? "product" : "products"} from this count?`}>
          <s-paragraph>This removes the selected products and their counted quantities from the count sheet. It does not change Shopify inventory.</s-paragraph>
          <s-unordered-list>
            {selectedLines.slice(0, 5).map((line) => (
              <s-list-item key={line.id}>
                {line.productTitle}{line.variantTitle ? ` — ${line.variantTitle}` : ""} — Counted: {line.countedQuantity}
              </s-list-item>
            ))}
          </s-unordered-list>
          {selectedLines.length > 5 && <s-paragraph>And {selectedLines.length - 5} more</s-paragraph>}
          {wouldRemoveEveryLine && (
            <s-banner tone="critical">An inventory count must contain at least one product.</s-banner>
          )}
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="remove-count-lines" />
            <input type="hidden" name="countId" value={countId} />
            {[...selectedIds].map((lineId) => (
              <input key={lineId} type="hidden" name="lineIds" value={lineId} />
            ))}
            <s-stack direction="inline" gap="base">
              <s-button type="button" onClick={() => setConfirming(false)}>Keep Products</s-button>
              <s-button tone="critical" type="submit" disabled={busy || wouldRemoveEveryLine}>Remove Products</s-button>
            </s-stack>
          </fetcher.Form>
        </s-section>
      )}

      {sort && <s-button onClick={resetSort}>Reset Sort</s-button>}

      <s-text>Showing {sortedLines.length} of {lines.length} variants</s-text>
      {sortedLines.length === 0 ? (
        <s-paragraph>No products in this count match your search.</s-paragraph>
      ) : (
        <div className={styles.container}>
          <table className={styles.table}>
            <thead><tr>
              {selectionMode && <th className={styles.selectionCell}><SelectAllCheckbox checked={allVisibleSelected} indeterminate={someVisibleSelected} onChange={toggleAllVisible} /></th>}
              <SortableTableHeader column="product" label="Product" sort={sort} onSort={toggleSort} className={selectionMode ? styles.productWithSelection : undefined} />
              <SortableTableHeader column="variant" label="Variant" sort={sort} onSort={toggleSort} />
              <SortableTableHeader column="sku" label="SKU" sort={sort} onSort={toggleSort} />
              <SortableTableHeader column="barcode" label="Barcode" sort={sort} onSort={toggleSort} />
              <SortableTableHeader column="expected" label="Expected" sort={sort} onSort={toggleSort} className={styles.number} />
              <SortableTableHeader column="counted" label="Counted" sort={sort} onSort={toggleSort} />
              <SortableTableHeader column="variance" label="Variance" sort={sort} onSort={toggleSort} className={styles.number} />
              <SortableTableHeader column="status" label="Status" sort={sort} onSort={toggleSort} />
            </tr></thead>
            <tbody>
              {sortedLines.map((line) => {
                const selected = selectedIds.has(line.id);
                return (
                  <tr key={line.id} className={selected ? styles.selectedRow : undefined}>
                    {selectionMode && <td className={styles.selectionCell}><input type="checkbox" checked={selected} onChange={() => toggleLine(line.id)} aria-label={`Select ${line.productTitle}${line.variantTitle ? ` — ${line.variantTitle}` : ""}`} /></td>}
                    <td className={`${styles.product} ${selectionMode ? styles.productWithSelection : ""}`}>{line.productTitle}</td>
                    <td>{line.variantTitle || "—"}</td>
                    <td>{line.sku || "—"}</td>
                    <td>{line.barcode || "—"}</td>
                    <td className={styles.number}>{line.startingQuantity ?? 0}</td>
                    <td><QuantityControl countId={countId} lineId={line.id} productTitle={line.productTitle} quantity={line.countedQuantity} /></td>
                    <td className={styles.number}>{variance(line)}</td>
                    <td><s-badge>{line.status}</s-badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </s-stack>
  );
}
