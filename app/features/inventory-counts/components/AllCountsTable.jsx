/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher, useSearchParams } from "react-router";
import { formatInventoryCountNumber } from "../utils/inventory-count-number";
import styles from "./all-counts.module.css";

const DEFAULT_SORT = { column: "lastActivity", direction: "desc" };
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const columns = [
  ["count", "Count"], ["status", "Status"], ["location", "Location"],
  ["area", "Area"], ["employee", "Employee"], ["started", "Started"],
  ["completed", "Completed"], ["productsCounted", "Products counted"],
  ["totalProducts", "Total products"], ["quantityCounted", "Quantity counted"],
  ["expectedQuantity", "Expected quantity"], ["variance", "Variance"],
  ["lastActivity", "Last activity"],
];

const valueFor = {
  count: (count) => count.countNumber,
  status: (count) => count.status,
  location: (count) => count.locationName,
  area: (count) => count.area,
  employee: (count) => count.createdBy,
  started: (count) => count.startedAt,
  completed: (count) => count.completedAt,
  productsCounted: (count) => count.progress.productsCounted,
  totalProducts: (count) => count.progress.totalProducts,
  quantityCounted: (count) => count.progress.quantityCounted,
  expectedQuantity: (count) => count.progress.totalQuantity,
  variance: (count) => count.variance,
  lastActivity: (count) => count.lastActivity,
};

const numericColumns = new Set([
  "count", "productsCounted", "totalProducts", "quantityCounted",
  "expectedQuantity", "variance",
]);
const dateColumns = new Set(["started", "completed", "lastActivity"]);

function compareNullable(left, right, direction, comparison) {
  const leftBlank = left == null || left === "";
  const rightBlank = right == null || right === "";
  if (leftBlank || rightBlank) {
    if (leftBlank && rightBlank) return 0;
    const base = leftBlank ? 1 : -1;
    return direction === "asc" ? base : -base;
  }
  return comparison(left, right) * (direction === "asc" ? 1 : -1);
}

function sortCounts(counts, sort) {
  return counts.map((count, index) => ({ count, index })).sort((a, b) => {
    const left = valueFor[sort.column](a.count);
    const right = valueFor[sort.column](b.count);
    let comparison;
    if (numericColumns.has(sort.column)) {
      comparison = compareNullable(left, right, sort.direction, (x, y) => x - y);
    } else if (dateColumns.has(sort.column)) {
      comparison = compareNullable(left, right, sort.direction, (x, y) => new Date(x) - new Date(y));
    } else {
      comparison = compareNullable(left, right, sort.direction, (x, y) =>
        String(x).localeCompare(String(y), undefined, { sensitivity: "base", numeric: true }),
      );
    }
    return comparison || a.index - b.index;
  }).map(({ count }) => count);
}

function SortHeader({ column, label, sort, onSort }) {
  const active = sort.column === column;
  const direction = active ? sort.direction : null;
  return (
    <div role="columnheader" aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
      <button type="button" className={styles.sortButton} onClick={() => onSort(column)} aria-label={`Sort ${label} ${direction === "asc" ? "descending" : "ascending"}`}>
        {label} <span aria-hidden="true">{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "⇅"}</span>
      </button>
    </div>
  );
}

function formatDate(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

export function AllCountsTable({ counts }) {
  const fetcher = useFetcher();
  const modalRef = useRef(null);
  const selectAllRef = useRef(null);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedSort, setSelectedSort] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const status = params.get("status") || "ALL";
  const activeSort = selectedSort ?? DEFAULT_SORT;

  const visibleCounts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const filtered = counts
      .filter((count) => {
        if (status === "ARCHIVED") return Boolean(count.archivedAt);
        if (count.archivedAt) return false;
        return status === "ALL" || count.status === status;
      })
      .filter((count) => !needle || [
        formatInventoryCountNumber(count.countNumber), count.locationName,
        count.area, count.createdBy, count.status,
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(needle)));
    return sortCounts(filtered, activeSort);
  }, [activeSort, counts, search, status]);

  const visibleArchivableIds = useMemo(
    () => visibleCounts.filter((count) => !count.archivedAt).map((count) => count.id),
    [visibleCounts],
  );
  const visibleArchivableIdSet = useMemo(
    () => new Set(visibleArchivableIds),
    [visibleArchivableIds],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCounts = useMemo(
    () => visibleCounts.filter((count) => selectedIdSet.has(count.id) && !count.archivedAt),
    [selectedIdSet, visibleCounts],
  );
  const allVisibleSelected =
    visibleArchivableIds.length > 0 &&
    visibleArchivableIds.every((id) => selectedIdSet.has(id));
  const someVisibleSelected = visibleArchivableIds.some((id) =>
    selectedIdSet.has(id),
  );
  const hasIncompleteSelection = selectedCounts.some((count) =>
    ["DRAFT", "COUNTING", "REVIEW"].includes(count.status),
  );

  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((id) => visibleArchivableIdSet.has(id));
      return next.length === current.length ? current : next;
    });
  }, [visibleArchivableIdSet]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        someVisibleSelected && !allVisibleSelected;
    }
  }, [allVisibleSelected, someVisibleSelected]);

  useEffect(() => {
    if (fetcher.data?.success) {
      setSelectedIds([]);
      modalRef.current?.hideOverlay();
    }
  }, [fetcher.data]);

  function updateParam(name, value, defaultValue) {
    const next = new URLSearchParams(params);
    if (value === defaultValue) next.delete(name);
    else next.set(name, value);
    setParams(next);
  }

  function toggleSort(column) {
    setSelectedSort((current) => {
      if (!current || current.column !== column) return { column, direction: "asc" };
      if (current.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  }

  function toggleCount(countId) {
    setSelectedIds((current) =>
      current.includes(countId)
        ? current.filter((id) => id !== countId)
        : [...current, countId],
    );
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleArchivableIdSet.has(id));
      }
      return [...new Set([...current, ...visibleArchivableIds])];
    });
  }

  const noActiveCounts = counts.length > 0 && counts.every((count) => count.archivedAt);
  let emptyMessage = "No counts match the current filters.";
  if (counts.length === 0) emptyMessage = "No inventory counts found.";
  else if (status !== "ARCHIVED" && noActiveCounts) emptyMessage = "No active inventory counts found.";

  return (
    <s-stack direction="block" gap="base">
      <div className={styles.filters}>
        <label><span>Search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search counts" /></label>
        <label><span>Status</span><select value={status} onChange={(event) => updateParam("status", event.target.value, "ALL")}><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="COUNTING">Counting</option><option value="REVIEW">Review</option><option value="COMPLETED">Completed</option><option value="ARCHIVED">Archived</option></select></label>
        {selectedSort && <button type="button" onClick={() => setSelectedSort(null)}>Reset Sort</button>}
      </div>
      {selectedCounts.length > 0 && (
        <div className={styles.bulkActionBar}>
          <strong>
            {selectedCounts.length} {selectedCounts.length === 1 ? "count" : "counts"} selected
          </strong>
          <s-button
            variant="primary"
            commandFor="bulk-archive-modal"
            command="--show"
          >
            Archive selected
          </s-button>
        </div>
      )}
      {selectedCounts.length > 0 && (
        <fetcher.Form method="post" action="/app/inventory-counts?index">
          <input type="hidden" name="intent" value="archive" />
          {selectedCounts.map((count) => (
            <input key={count.id} type="hidden" name="countId" value={count.id} />
          ))}
          <s-modal
            ref={modalRef}
            id="bulk-archive-modal"
            heading={`Archive ${selectedCounts.length} inventory ${selectedCounts.length === 1 ? "count" : "counts"}?`}
            accessibilityLabel={`Confirm archiving ${selectedCounts.length} inventory ${selectedCounts.length === 1 ? "count" : "counts"}`}
          >
            <s-stack direction="block" gap="base">
              <s-paragraph>
                Archived counts will be removed from the active list but their
                inventory history and count data will be preserved.
              </s-paragraph>
              {hasIncompleteSelection && (
                <s-banner tone="warning">
                  Some selected counts are not complete. Archiving them will
                  remove them from the active count list, but their data will
                  be preserved.
                </s-banner>
              )}
              {fetcher.data?.error && (
                <s-banner tone="critical">{fetcher.data.error}</s-banner>
              )}
            </s-stack>
            <s-button
              slot="secondary-actions"
              commandFor="bulk-archive-modal"
              command="--hide"
            >
              Keep Counts
            </s-button>
            <s-button
              slot="primary-action"
              variant="primary"
              type="submit"
              loading={fetcher.state !== "idle"}
            >
              {selectedCounts.length === 1
                ? "Archive Count"
                : `Archive ${selectedCounts.length} Counts`}
            </s-button>
          </s-modal>
        </fetcher.Form>
      )}
      {visibleCounts.length === 0 ? <s-paragraph>{emptyMessage}</s-paragraph> : (
        <div className={styles.table} role="table" aria-label="All inventory counts">
          <div className={styles.header} role="row">
            <div role="columnheader" className={styles.selectionCell}>
              <input
                ref={selectAllRef}
                type="checkbox"
                aria-label="Select all visible counts"
                checked={allVisibleSelected}
                disabled={visibleArchivableIds.length === 0}
                onChange={toggleAllVisible}
              />
            </div>
            {columns.map(([column, label]) => <SortHeader key={column} column={column} label={label} sort={activeSort} onSort={toggleSort} />)}
          </div>
          {visibleCounts.map((count) => (
            <div className={styles.row} role="row" key={count.id}>
              <div className={styles.selectionCell} role="cell">
                <input
                  type="checkbox"
                  aria-label={`Select Count ${formatInventoryCountNumber(count.countNumber)}`}
                  checked={selectedIdSet.has(count.id)}
                  disabled={Boolean(count.archivedAt)}
                  onChange={() => toggleCount(count.id)}
                />
              </div>
              <Link className={styles.rowLink} to={`/app/inventory-counts/${count.id}`} aria-label={`Open Count ${formatInventoryCountNumber(count.countNumber)}`}>
                <span>{formatInventoryCountNumber(count.countNumber)}<br /><small>{count.countType === "BLANK_SCAN" ? "Blank Scan" : "Product Type"}</small></span>
                <span><s-badge>{count.status}</s-badge>{count.archivedAt && <s-badge tone="attention">Archived</s-badge>}</span>
                <span>{count.locationName}</span><span>{count.area}</span><span>{count.createdBy || "—"}</span>
                <span>{formatDate(count.startedAt)}</span><span>{formatDate(count.completedAt)}</span>
                <span>{count.progress.productsCounted}</span><span>{count.progress.totalProducts}</span>
                <span>{count.progress.quantityCounted}</span><span>{count.progress.totalQuantity}</span>
                <span>{count.variance > 0 ? `+${count.variance}` : count.variance}</span><span>{formatDate(count.lastActivity)}</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </s-stack>
  );
}
