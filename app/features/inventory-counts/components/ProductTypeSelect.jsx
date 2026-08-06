/* eslint-disable react/prop-types */
export function ProductTypeSelect({ productTypes, hasUncategorized, defaults = [], error }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <strong>Product Types</strong>
      <select name="productTypes" multiple size={Math.min(productTypes.length + 2, 10)} defaultValue={defaults} required>
        <option value="__ALL__">All product types</option>
        {productTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        {hasUncategorized && <option value="__UNCATEGORIZED__">Uncategorized</option>}
      </select>
      <small>Hold Ctrl (Windows) or Command (Mac) to select multiple types.</small>
      {error && <span style={{ color: "#b42318" }}>{error}</span>}
    </label>
  );
}
