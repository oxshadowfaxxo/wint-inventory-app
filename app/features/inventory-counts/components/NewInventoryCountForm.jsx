/* eslint-disable react/prop-types */
import { Form, useNavigation } from "react-router";
import { LocationSelect } from "./LocationSelect";
import { ProductTypeSelect } from "./ProductTypeSelect";
import { CountScopePreview } from "./CountScopePreview";

export function NewInventoryCountForm({ loaderData, actionData }) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const preview = actionData?.preview;
  const values = actionData?.values || {};

  if (preview) {
    return (
      <Form method="post">
        <input type="hidden" name="intent" value="create" />
        <input type="hidden" name="locationId" value={preview.configuration.locationId} />
        <input type="hidden" name="area" value={preview.configuration.area} />
        <input type="hidden" name="employee" value={preview.configuration.employee} />
        {preview.configuration.productTypes.map((type) => (
          <input key={type} type="hidden" name="productTypes" value={type} />
        ))}
        <CountScopePreview preview={preview} error={actionData?.error} />
        {preview.overlaps.length > 0 && (
          <s-section>
            <label><input type="checkbox" name="confirmOverlap" value="yes" /> Create this count anyway</label>
          </s-section>
        )}
        <s-section>
          <s-stack direction="inline" gap="base">
            <s-button href="/app/inventory-counts/new">Back</s-button>
            <s-button variant="primary" type="submit" {...(busy ? { loading: true } : {})}>Create &amp; Start Counting</s-button>
          </s-stack>
        </s-section>
      </Form>
    );
  }

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="preview" />
      <s-section heading="Configure count">
        <div style={{ display: "grid", gap: 18, maxWidth: 640 }}>
          {actionData?.error && <s-banner tone="critical">{actionData.error}</s-banner>}
          <LocationSelect locations={loaderData.locations} defaultValue={values.locationId} error={actionData?.errors?.locationId} />
          <label style={{ display: "grid", gap: 6 }}><strong>Area</strong><input name="area" defaultValue={values.area || ""} required />{actionData?.errors?.area && <span style={{ color: "#b42318" }}>{actionData.errors.area}</span>}</label>
          <label style={{ display: "grid", gap: 6 }}><strong>Employee</strong><input name="employee" defaultValue={values.employee || ""} required />{actionData?.errors?.employee && <span style={{ color: "#b42318" }}>{actionData.errors.employee}</span>}</label>
          <ProductTypeSelect productTypes={loaderData.productTypes} hasUncategorized={loaderData.hasUncategorized} defaults={values.productTypes} error={actionData?.errors?.productTypes} />
        </div>
      </s-section>
      <s-section><s-button variant="primary" type="submit" {...(busy ? { loading: true } : {})}>Preview Count</s-button></s-section>
    </Form>
  );
}
