import { Form, redirect, useActionData, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { CountingProductsTable } from "../features/inventory-counts/components/CountingProductsTable";
import { AddProductSearch } from "../features/inventory-counts/components/AddProductSearch";
import { getInventoryCount } from "../features/inventory-counts/services/inventory-counts.server";
import {
  finishInventoryCount,
  friendlyWorkflowError,
  transitionInventoryCount,
  updateInventoryLineQuantity,
  addProductToInventoryCount,
  removeInventoryCountLines,
  scanInventoryCountBarcode,
} from "../features/inventory-counts/services/inventory-count-workflow.server";
import {
  getShopifyVariantForAddition,
  searchShopifyVariants,
} from "../features/inventory-counts/services/shopify-inventory.server";
import { formatInventoryCountNumber } from "../features/inventory-counts/utils/inventory-count-number";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const count = params.countId
    ? await getInventoryCount(session.shop, params.countId)
    : null;
  if (!count) throw new Response("Inventory count not found.", { status: 404 });
  if (count.status !== "COUNTING") {
    return redirect(`/app/inventory-counts/${count.id}`);
  }
  return {
    count: {
      ...count,
      displayNumber: formatInventoryCountNumber(count.countNumber),
    },
  };
};

export const action = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const countId = params.countId;
  if (!countId) return { error: "Inventory count not found." };
  try {
    if (formData.get("countId") && formData.get("countId") !== countId) {
      return { error: "Inventory count not found." };
    }
    if (
      ["increment-line", "decrement-line", "set-line-quantity"].includes(intent)
    ) {
      const line = await updateInventoryLineQuantity({
        shop: session.shop,
        countId,
        lineId: String(formData.get("lineId") || ""),
        intent,
        submittedQuantity: formData.get("quantity"),
      });
      return { line };
    }
    if (intent === "scan-barcode") {
      const barcode = String(formData.get("barcode") || "").trim();
      try {
        const scan = await scanInventoryCountBarcode({
          shop: session.shop,
          countId,
          barcode,
        });
        return { scan };
      } catch (error) {
        if (error.code === "BARCODE_NOT_FOUND") {
          return { error: error.message, barcode, scanError: true };
        }
        throw error;
      }
    }
    if (intent === "remove-count-lines") {
      const removedCount = await removeInventoryCountLines({
        shop: session.shop,
        countId,
        lineIds: formData.getAll("lineIds").map(String),
      });
      return {
        removedCount,
        message: `${removedCount} ${removedCount === 1 ? "product" : "products"} removed from the count.`,
      };
    }
    if (intent === "search-shopify") {
      const count = await getInventoryCount(session.shop, countId);
      if (!count || count.status !== "COUNTING") {
        return { error: "This count is not in counting mode.", searched: true };
      }
      const search = String(formData.get("search") || "").trim();
      if (!search)
        return { error: "Enter a Shopify product search.", searched: true };
      const results = await searchShopifyVariants(
        admin,
        count.locationId,
        search,
      );
      return { results, searched: true };
    }
    if (intent === "add-product") {
      const count = await getInventoryCount(session.shop, countId);
      if (!count || count.status !== "COUNTING") {
        return { error: "This count is not in counting mode." };
      }
      const variant = await getShopifyVariantForAddition(
        admin,
        count.locationId,
        String(formData.get("variantId") || ""),
      );
      await addProductToInventoryCount({
        shop: session.shop,
        countId,
        variant,
      });
      return { added: true };
    }
    if (intent === "save") {
      await transitionInventoryCount({
        shop: session.shop,
        countId,
        transition: "save",
      });
      return redirect(`/app/inventory-counts/${countId}`);
    }
    if (intent === "finish" || intent === "commit-and-finish") {
      const warning = await finishInventoryCount({
        shop: session.shop,
        countId,
        commitUncounted: intent === "commit-and-finish",
      });
      if (warning) return { finishWarning: warning };
      return redirect(`/app/inventory-counts/${countId}`);
    }
    return { error: "Choose a valid inventory count action." };
  } catch (error) {
    if (error.userMessage) {
      console.error("Shopify Add Product validation failed", {
        shop: session.shop,
        countId,
        message: error.message,
      });
      return { error: error.userMessage };
    }
    return { error: friendlyWorkflowError(error) };
  }
};

export default function InventoryCountCountingPage() {
  const { count } = useLoaderData();
  const actionData = useActionData();
  return (
    <s-page heading={`Count: ${count.displayNumber}`}>
      <s-badge slot="accessory" tone="info">
        COUNTING
      </s-badge>
      <s-button
        slot="secondary-actions"
        onClick={() =>
          document.getElementById("save-count-form")?.requestSubmit()
        }
      >
        Save &amp; Exit
      </s-button>
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() =>
          document.getElementById("finish-count-form")?.requestSubmit()
        }
      >
        Finish Counting
      </s-button>
      <Form method="post" id="save-count-form" hidden>
        <input type="hidden" name="intent" value="save" />
      </Form>
      <Form method="post" id="finish-count-form" hidden>
        <input type="hidden" name="intent" value="finish" />
      </Form>
      {actionData?.error && (
        <s-banner tone="critical">{actionData.error}</s-banner>
      )}

      {actionData?.finishWarning && (
        <s-section heading="Uncounted variants">
          <s-banner tone="warning">
            {actionData.finishWarning.variants} variants have not been counted.
            These variants represent {actionData.finishWarning.expectedQuantity}{" "}
            expected units.
          </s-banner>
          <Form method="post">
            <input type="hidden" name="intent" value="commit-and-finish" />
            <s-stack direction="inline" gap="base">
              <s-button href={`/app/inventory-counts/${count.id}/count`}>
                Go Back and Continue Counting
              </s-button>
              <s-button variant="primary" type="submit">
                Commit Uncounted Items and Finish
              </s-button>
            </s-stack>
          </Form>
        </s-section>
      )}

      <s-section heading="Products">
        <CountingProductsTable countId={count.id} lines={count.lines} />
      </s-section>

      <AddProductSearch
        countId={count.id}
        existingVariantIds={count.lines.map((line) => line.variantId)}
      />

      <s-section heading="Notes">
        <s-paragraph>{count.notes?.trim() || "No notes added."}</s-paragraph>
      </s-section>

    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
