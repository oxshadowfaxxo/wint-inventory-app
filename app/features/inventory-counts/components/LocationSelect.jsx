/* eslint-disable react/prop-types */
export function LocationSelect({ locations, defaultValue, error }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <strong>Shopify Location</strong>
      <select name="locationId" defaultValue={defaultValue || ""} required>
        <option value="" disabled>Select a location</option>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>{location.name}</option>
        ))}
      </select>
      {error && <span style={{ color: "#b42318" }}>{error}</span>}
    </label>
  );
}
