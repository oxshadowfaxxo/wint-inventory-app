/* eslint-disable react/prop-types */

import { Link } from "react-router";
import styles from "./current-counts.module.css";
import { formatInventoryCountNumber } from "../utils/inventory-count-number";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value, fallback) {
  return value ? dateTimeFormatter.format(new Date(value)) : fallback;
}

function formatCountNumber(count) {
  if (Number.isInteger(count.countNumber)) {
    return formatInventoryCountNumber(count.countNumber);
  }
  const numericName = count.name.match(/\d+/)?.[0];

  if (numericName) {
    return numericName.padStart(3, "0");
  }

  const idNumber = [...count.id].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 1000,
    0,
  );

  return String(idNumber).padStart(3, "0");
}

export function CurrentCountsHeader() {
  return (
    <div className={styles.header}>
      <span>Count</span>
      <span>Status</span>
      <span>Location</span>
      <span>Started</span>
      <span>Employee</span>
      <span>Products</span>
      <span>Quantity</span>
      <span>Last activity</span>
    </div>
  );
}

export function CurrentCountRow({ count }) {
  const countNumber = formatCountNumber(count);

  return (
    <Link
      to={`/app/inventory-counts/${count.id}`}
      className={styles.row}
      aria-label={`Open Count ${countNumber} at ${count.locationName}`}
    >
      <span className={styles.countNumber} data-label="Count">
        {countNumber}<br /><small>{count.countType === "BLANK_SCAN" ? "Blank Scan" : "Product Type"}</small>
      </span>
      <span className={styles.cell} data-label="Status">
        <s-badge>{count.status}</s-badge>
      </span>
      <span className={styles.cell} data-label="Location">
        {count.locationName}
      </span>
      <span className={styles.cell} data-label="Started">
        {formatDateTime(count.startedAt, "Not started")}
      </span>
      <span className={styles.cell} data-label="Employee">
        {count.createdBy || "Not assigned"}
      </span>
      <span className={styles.cell} data-label="Products">
        {count.countType === "BLANK_SCAN" ? `${count.progress.totalProducts} variants` : `${count.progress.productsCounted} of ${count.progress.totalProducts}`}
      </span>
      <span className={styles.cell} data-label="Quantity">
        {count.countType === "BLANK_SCAN" ? `${count.progress.quantityCounted} counted` : `${count.progress.quantityCounted} of ${count.progress.totalQuantity}`}
      </span>
      <span className={styles.cell} data-label="Last activity">
        {formatDateTime(count.lastActivity, "Unknown")}
      </span>
    </Link>
  );
}
