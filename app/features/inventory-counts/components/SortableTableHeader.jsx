/* eslint-disable react/prop-types */
import styles from "./count-lines-table.module.css";

export function SortableTableHeader({
  column,
  label,
  sort,
  onSort,
  className,
}) {
  const active = sort?.column === column;
  const direction = active ? sort.direction : null;
  const nextAction = !active
    ? "ascending"
    : direction === "asc"
      ? "descending"
      : "to default order";
  return (
    <th
      scope="col"
      className={className}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
    >
      <button
        type="button"
        className={styles.sortButton}
        onClick={() => onSort(column)}
        aria-label={`Sort ${label} ${nextAction}`}
      >
        <span>{label}</span>
        <span aria-hidden="true">{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "⇅"}</span>
      </button>
    </th>
  );
}
