/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
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

function ArchiveAction({ count }) {
  const fetcher = useFetcher();
  const [confirming, setConfirming] = useState(false);
  const archived = Boolean(count.archivedAt);
  const eligible = ["COMPLETED", "CANCELLED"].includes(count.status);
  useEffect(() => {
    if (fetcher.data?.success) setConfirming(false);
  }, [fetcher.data]);
  if (!archived && !eligible) return <span>—</span>;
  if (!confirming) {
    return <button type="button" onClick={() => setConfirming(true)}>{archived ? "Unarchive" : "Archive"}</button>;
  }
  return (
    <div className={styles.confirmation}>
      <strong>{archived ? `Restore Count: ${formatInventoryCountNumber(count.countNumber)} to the active list?` : `Archive Count: ${formatInventoryCountNumber(count.countNumber)}?`}</strong>
      {!archived && <span>Archived counts remain available for reporting.</span>}
      <fetcher.Form method="post" action="/app/inventory-counts">
        <input type="hidden" name="intent" value={archived ? "unarchive" : "archive"} />
        <input type="hidden" name="countId" value={count.id} />
        <div className={styles.confirmationActions}>
          <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
          <button type="submit" className={archived ? undefined : styles.dangerButton} disabled={fetcher.state !== "idle"}>{archived ? "Restore Count" : "Archive Count"}</button>
        </div>
      </fetcher.Form>
      {fetcher.data?.error && <span className={styles.error}>{fetcher.data.error}</span>}
    </div>
  );
}

function formatDate(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

export function AllCountsTable({ counts }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedSort, setSelectedSort] = useState(null);
  const status = params.get("status") || "ALL";
  const showArchived = params.get("archived") === "show";
  const activeSort = selectedSort ?? DEFAULT_SORT;

  const visibleCounts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const filtered = counts
      .filter((count) => showArchived || !count.archivedAt)
      .filter((count) => !needle || [
        formatInventoryCountNumber(count.countNumber), count.locationName,
        count.area, count.createdBy, count.status,
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(needle)))
      .filter((count) => status === "ALL" || count.status === status);
    return sortCounts(filtered, activeSort);
  }, [activeSort, counts, search, showArchived, status]);

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

  const noActiveCounts = counts.length > 0 && counts.every((count) => count.archivedAt);
  let emptyMessage = "No counts match the current filters.";
  if (counts.length === 0) emptyMessage = "No inventory counts found.";
  else if (!showArchived && noActiveCounts) emptyMessage = "No active inventory counts found.";

  return (
    <s-stack direction="block" gap="base">
      <div className={styles.filters}>
        <label><span>Search</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search counts" /></label>
        <label><span>Status</span><select value={status} onChange={(event) => updateParam("status", event.target.value, "ALL")}><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="COUNTING">Counting</option><option value="REVIEW">Review</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></label>
        <label className={styles.checkbox}><input type="checkbox" checked={showArchived} onChange={(event) => updateParam("archived", event.target.checked ? "show" : "hide", "hide")} /> Show archived counts</label>
        {selectedSort && <button type="button" onClick={() => setSelectedSort(null)}>Reset Sort</button>}
      </div>
      {visibleCounts.length === 0 ? <s-paragraph>{emptyMessage}</s-paragraph> : (
        <div className={styles.table} role="table" aria-label="All inventory counts">
          <div className={styles.header} role="row">{columns.map(([column, label]) => <SortHeader key={column} column={column} label={label} sort={activeSort} onSort={toggleSort} />)}<div role="columnheader">Archive</div></div>
          {visibleCounts.map((count) => (
            <div className={styles.row} role="row" key={count.id}>
              <Link className={styles.rowLink} to={`/app/inventory-counts/${count.id}`} aria-label={`Open Count ${formatInventoryCountNumber(count.countNumber)}`}>
                <span>{formatInventoryCountNumber(count.countNumber)}</span>
                <span><s-badge>{count.status}</s-badge>{count.archivedAt && <s-badge tone="attention">Archived</s-badge>}</span>
                <span>{count.locationName}</span><span>{count.area}</span><span>{count.createdBy || "—"}</span>
                <span>{formatDate(count.startedAt)}</span><span>{formatDate(count.completedAt)}</span>
                <span>{count.progress.productsCounted}</span><span>{count.progress.totalProducts}</span>
                <span>{count.progress.quantityCounted}</span><span>{count.progress.totalQuantity}</span>
                <span>{count.variance > 0 ? `+${count.variance}` : count.variance}</span><span>{formatDate(count.lastActivity)}</span>
              </Link>
              <div className={styles.archiveAction}><ArchiveAction count={count} /></div>
            </div>
          ))}
        </div>
      )}
    </s-stack>
  );
}
