import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { CountingProductsTable } from "../features/inventory-counts/components/CountingProductsTable";
import { AddProductSearch } from "../features/inventory-counts/components/AddProductSearch";
import { getInventoryCount } from "../features/inventory-counts/services/inventory-counts.server";
import {
  cancelInventoryCount,
  finishInventoryCount,
  friendlyWorkflowError,
  transitionInventoryCount,
  updateInventoryLineQuantity,
  addProductToInventoryCount,
  removeInventoryCountLines,
} from "../features/inventory-counts/services/inventory-count-workflow.server";
import {
  getShopifyVariantForAddition,
  searchShopifyVariants,
} from "../features/inventory-counts/services/shopify-inventory.server";
import { calculateCountProgress } from "../features/inventory-counts/utils/inventory-count-progress";
import { formatInventoryCountNumber } from "../features/inventory-counts/utils/inventory-count-number";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

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
      progress: calculateCountProgress(count.lines),
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
    if (["increment-line", "decrement-line", "set-line-quantity"].includes(intent)) {
      const line = await updateInventoryLineQuantity({
        shop: session.shop,
        countId,
        lineId: String(formData.get("lineId") || ""),
        intent,
        submittedQuantity: formData.get("quantity"),
      });
      return { line };
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
      if (!search) return { error: "Enter a Shopify product search.", searched: true };
      const results = await searchShopifyVariants(admin, count.locationId, search);
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
      await addProductToInventoryCount({ shop: session.shop, countId, variant });
      return { added: true };
    }
    if (intent === "save") {
      await transitionInventoryCount({ shop: session.shop, countId, transition: "save" });
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
    if (intent === "cancel") {
      await cancelInventoryCount({
        shop: session.shop,
        countId,
        reason: String(formData.get("reason") || ""),
      });
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
      <s-banner tone="info"><strong>Counting mode</strong></s-banner>
      {actionData?.error && <s-banner tone="critical">{actionData.error}</s-banner>}

      <s-section heading="Count summary">
        <s-stack direction="block" gap="base">
          <s-text>Status: <s-badge>{count.status}</s-badge></s-text>
          <s-text>Location: {count.locationName}</s-text>
          <s-text>Area: {count.area}</s-text>
          <s-text>Employee: {count.createdBy || "Not assigned"}</s-text>
          <s-text>Started: {count.startedAt ? dateTimeFormatter.format(new Date(count.startedAt)) : "Not started"}</s-text>
          <s-text>Products: {count.progress.productsCounted} of {count.progress.totalProducts}</s-text>
          <s-text>Quantity: {count.progress.quantityCounted} of {count.progress.totalQuantity}</s-text>
        </s-stack>
      </s-section>

      <s-section heading="Counting actions">
        <s-stack direction="inline" gap="base">
          <Form method="post">
            <input type="hidden" name="intent" value="save" />
            <s-button type="submit">Save &amp; Exit</s-button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="finish" />
            <s-button variant="primary" type="submit">Finish Counting</s-button>
          </Form>
        </s-stack>
      </s-section>

      {actionData?.finishWarning && (
        <s-section heading="Uncounted variants">
          <s-banner tone="warning">
            {actionData.finishWarning.variants} variants have not been counted. These variants represent {actionData.finishWarning.expectedQuantity} expected units.
          </s-banner>
          <Form method="post">
            <input type="hidden" name="intent" value="commit-and-finish" />
            <s-stack direction="inline" gap="base">
              <s-button href={`/app/inventory-counts/${count.id}/count`}>Go Back and Continue Counting</s-button>
              <s-button variant="primary" type="submit">Commit Uncounted Items and Finish</s-button>
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

      <s-section heading="Cancel count">
        <s-paragraph>Cancelling is permanent. Enter a reason to confirm.</s-paragraph>
        <Form method="post">
          <input type="hidden" name="intent" value="cancel" />
          <div style={{ display: "grid", gap: 12, maxWidth: 640 }}>
            <label><strong>Cancellation reason</strong><textarea name="reason" required rows={3} style={{ display: "block", width: "100%" }} /></label>
            <s-button tone="critical" type="submit">Cancel Count</s-button>
          </div>
        </Form>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
