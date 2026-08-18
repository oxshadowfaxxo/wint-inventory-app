/* eslint-disable react/prop-types */
import { useState } from "react";
import { Form, useNavigate, useNavigation } from "react-router";
import { LocationSelect } from "./LocationSelect";
import { ProductTypeSelect } from "./ProductTypeSelect";
import { CountScopePreview } from "./CountScopePreview";

export function NewInventoryCountForm({ loaderData, actionData }) {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const busy = navigation.state !== "idle";
  const preview = actionData?.preview;
  const values = actionData?.values || {};
  const [countType, setCountType] = useState(values.countType || "PRODUCT_TYPE");

  if (preview) {
    return (
      <Form method="post">
        <input type="hidden" name="intent" value="create" />
        <input type="hidden" name="locationId" value={preview.configuration.locationId} />
        <input type="hidden" name="area" value={preview.configuration.area} />
        <input type="hidden" name="employee" value={preview.configuration.employee} />
        <input type="hidden" name="countType" value={preview.configuration.countType} />
        {preview.configuration.productTypes.map((type) => (
          <input key={type} type="hidden" name="productTypes" value={type} />
        ))}
        {preview.configuration.countType === "BLANK_SCAN" ? (
          <s-section heading="Count preview">
            <s-stack direction="block" gap="small">
              <s-text>Count Type: Blank Scan Count</s-text>
              <s-text>Location: {preview.configuration.locationName}</s-text>
              <s-text>Area: {preview.configuration.area}</s-text>
              <s-text>Employee: {preview.configuration.employee}</s-text>
              <s-text>Starting products: 0</s-text>
              <s-text>Starting expected quantity: 0</s-text>
            </s-stack>
          </s-section>
        ) : <CountScopePreview preview={preview} error={actionData?.error} />}
        {preview.overlaps.length > 0 && (
          <s-section>
            <label><input type="checkbox" name="confirmOverlap" value="yes" /> Create this count anyway</label>
          </s-section>
        )}
        <s-section>
          <s-stack direction="inline" gap="base">
            <s-button
              onClick={() =>
                navigate("/app/inventory-counts/new", { replace: true })
              }
            >
              Back
            </s-button>
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
          <fieldset style={{ display: "grid", gap: 10 }}>
            <legend><strong>Count type</strong></legend>
            <label><input type="radio" name="countType" value="PRODUCT_TYPE" checked={countType === "PRODUCT_TYPE"} onChange={() => setCountType("PRODUCT_TYPE")} /> Product Type Count<br /><small>Preloads selected Shopify product types and captures a frozen expected inventory snapshot before counting.</small></label>
            <label><input type="radio" name="countType" value="BLANK_SCAN" checked={countType === "BLANK_SCAN"} onChange={() => setCountType("BLANK_SCAN")} /> Blank Scan Count<br /><small>Starts empty. Products are added automatically when their barcode is scanned.</small></label>
          </fieldset>
          <LocationSelect locations={loaderData.locations} defaultValue={values.locationId} error={actionData?.errors?.locationId} />
          <label style={{ display: "grid", gap: 6 }}><strong>Area</strong><input name="area" defaultValue={values.area || ""} required />{actionData?.errors?.area && <span style={{ color: "#b42318" }}>{actionData.errors.area}</span>}</label>
          <label style={{ display: "grid", gap: 6 }}><strong>Employee</strong><input name="employee" defaultValue={values.employee || ""} required />{actionData?.errors?.employee && <span style={{ color: "#b42318" }}>{actionData.errors.employee}</span>}</label>
          {countType === "PRODUCT_TYPE" && <ProductTypeSelect productTypes={loaderData.productTypes} hasUncategorized={loaderData.hasUncategorized} defaults={values.productTypes} error={actionData?.errors?.productTypes} />}
        </div>
      </s-section>
      <s-section><s-button variant="primary" type="submit" {...(busy ? { loading: true } : {})}>Preview Count</s-button></s-section>
    </Form>
  );
}
