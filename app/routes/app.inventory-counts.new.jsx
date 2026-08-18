import { useActionData, useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { NewInventoryCountForm } from "../features/inventory-counts/components/NewInventoryCountForm";
import {
  createInventoryCount,
  findOverlappingCounts,
} from "../features/inventory-counts/services/inventory-counts.server";
import {
  ALL_PRODUCT_TYPES,
  UNCATEGORIZED_PRODUCT_TYPE,
  getActiveLocations,
  getInventorySnapshot,
  getProductTypes,
  summarizeSnapshot,
} from "../features/inventory-counts/services/shopify-inventory.server";

async function getOptions(admin) {
  const [locations, typeData] = await Promise.all([
    getActiveLocations(admin),
    getProductTypes(admin),
  ]);
  return { locations, ...typeData };
}

function readValues(formData) {
  const selected = [...new Set(formData.getAll("productTypes").map(String))];
  return {
    countType: formData.get("countType") === "BLANK_SCAN" ? "BLANK_SCAN" : "PRODUCT_TYPE",
    locationId: String(formData.get("locationId") || ""),
    area: String(formData.get("area") || "").trim(),
    employee: String(formData.get("employee") || "").trim(),
    productTypes: selected.includes(ALL_PRODUCT_TYPES) ? [ALL_PRODUCT_TYPES] : selected,
  };
}

function validate(values, options) {
  const errors = {};
  const location = options.locations.find((item) => item.id === values.locationId);
  if (!location) errors.locationId = "Select a Shopify location.";
  if (!values.area) errors.area = "Enter an area.";
  if (!values.employee) errors.employee = "Enter an employee name.";
  if (values.countType === "PRODUCT_TYPE" && !values.productTypes.length) errors.productTypes = "Select at least one product type.";
  if (values.countType === "PRODUCT_TYPE") {
    const validTypes = new Set([ALL_PRODUCT_TYPES, ...options.productTypes]);
    if (options.hasUncategorized) validTypes.add(UNCATEGORIZED_PRODUCT_TYPE);
    if (values.productTypes.some((type) => !validTypes.has(type))) {
      errors.productTypes = "Select valid product types.";
    }
  }
  return { errors, location };
}

async function preparePreview(admin, shop, values, options) {
  const { errors, location } = validate(values, options);
  if (Object.keys(errors).length) return { errors, values };
  const configuration = { ...values, locationName: location.name };
  if (values.countType === "BLANK_SCAN") {
    return {
      preview: {
        configuration: { ...configuration, productTypes: [] },
        summary: { totalVariants: 0, totalExpectedQuantity: 0 },
        overlaps: [],
      },
    };
  }
  const lines = await getInventorySnapshot(admin, values.locationId, values.productTypes);
  if (!lines.length) {
    return { error: "No inventory variants matched this count scope.", values };
  }
  const overlaps = await findOverlappingCounts({ shop, ...configuration });
  return {
    preview: {
      configuration,
      summary: summarizeSnapshot(lines),
      overlaps,
    },
  };
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  return getOptions(admin);
};

export const action = async ({ request }) => {
  const { admin, session, redirect } = await authenticate.admin(request);
  const formData = await request.formData();
  const values = readValues(formData);
  try {
    const options = values.countType === "BLANK_SCAN"
      ? { locations: await getActiveLocations(admin), productTypes: [], hasUncategorized: false }
      : await getOptions(admin);
    const prepared = await preparePreview(admin, session.shop, values, options);
    if (!prepared.preview || formData.get("intent") !== "create") return prepared;

    if (prepared.preview.overlaps.length && formData.get("confirmOverlap") !== "yes") {
      return {
        ...prepared,
        error: "Confirm that you want to create an overlapping count.",
      };
    }
    // Product Type snapshots are fetched again at creation time; Blank Scan starts empty.
    const lines = values.countType === "BLANK_SCAN"
      ? []
      : await getInventorySnapshot(admin, values.locationId, values.productTypes);
    if (values.countType === "PRODUCT_TYPE" && !lines.length) return { error: "No inventory variants matched this count scope.", values };
    const count = await createInventoryCount({
      shop: session.shop,
      configuration: prepared.preview.configuration,
      lines,
    });
    return redirect(`/app/inventory-counts/${count.id}/count`);
  } catch (error) {
    console.error("Inventory count creation failed", {
      shop: session.shop,
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
    return {
      error: error.code === "MISSING_ON_HAND"
        ? "One or more inventory quantities could not be loaded. No count was created."
        : "The inventory count could not be prepared. Please try again.",
      values,
    };
  }
};

export default function NewInventoryCountPage() {
  const navigate = useNavigate();

  return (
    <s-page heading="New Inventory Count">
      <s-button onClick={() => navigate("/app/inventory-counts")}>
        Back to Inventory Counts
      </s-button>
      <NewInventoryCountForm loaderData={useLoaderData()} actionData={useActionData()} />
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
