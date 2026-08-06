import { useMemo, useState } from "react";
import { sortInventoryCountLines } from "../utils/inventory-count-sort";

export function useInventoryCountSort(lines) {
  const [sort, setSort] = useState(null);
  const sortedLines = useMemo(
    () => sortInventoryCountLines(lines, sort),
    [lines, sort],
  );

  function toggleSort(column) {
    setSort((current) => {
      if (!current || current.column !== column) {
        return { column, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { column, direction: "desc" };
      }
      return null;
    });
  }

  return {
    sort,
    sortedLines,
    toggleSort,
    resetSort: () => setSort(null),
  };
}
