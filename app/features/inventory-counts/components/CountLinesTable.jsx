/* eslint-disable react/prop-types */

import styles from "./count-lines-table.module.css";

function formatVariance(countedQuantity, startingQuantity) {
  const variance = countedQuantity - (startingQuantity ?? 0);

  return variance > 0 ? `+${variance}` : String(variance);
}

export function CountLinesTable({ lines }) {
  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Variant</th>
            <th scope="col">SKU</th>
            <th scope="col">Barcode</th>
            <th scope="col" className={styles.number}>
              Expected
            </th>
            <th scope="col" className={styles.number}>
              Counted
            </th>
            <th scope="col" className={styles.number}>
              Variance
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td className={styles.product}>{line.productTitle}</td>
              <td>{line.variantTitle || "—"}</td>
              <td>{line.sku || "—"}</td>
              <td>{line.barcode || "—"}</td>
              <td className={styles.number}>{line.startingQuantity ?? 0}</td>
              <td className={styles.number}>{line.countedQuantity}</td>
              <td className={styles.number}>
                {formatVariance(
                  line.countedQuantity,
                  line.startingQuantity,
                )}
              </td>
              <td>
                <s-badge>{line.status}</s-badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
