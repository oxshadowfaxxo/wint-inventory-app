import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { CountLinesTable } from "../features/inventory-counts/components/CountLinesTable";
import { getInventoryCount } from "../features/inventory-counts/services/inventory-counts.server";
import {
  cancelInventoryCount,
  finishInventoryCount,
  friendlyWorkflowError,
  transitionInventoryCount,
} from "../features/inventory-counts/services/inventory-count-workflow.server";
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
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const countId = params.countId;
  if (!countId) return { error: "Inventory count not found." };
  try {
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
        <CountLinesTable lines={count.lines} />
      </s-section>

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
