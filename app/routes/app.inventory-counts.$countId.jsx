import {
  Form,
  isRouteErrorResponse,
  useActionData,
  useLoaderData,
  useNavigate,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { CountLinesTable } from "../features/inventory-counts/components/CountLinesTable";
import detailStyles from "../features/inventory-counts/components/count-detail.module.css";
import { getInventoryCount } from "../features/inventory-counts/services/inventory-counts.server";
import {
  calculateCountProgress,
  calculateVariance,
} from "../features/inventory-counts/utils/inventory-count-progress";
import { formatInventoryCountNumber } from "../features/inventory-counts/utils/inventory-count-number";
import {
  friendlyWorkflowError,
  refreshReviewInventory,
  transitionInventoryCount,
} from "../features/inventory-counts/services/inventory-count-workflow.server";
import { getCurrentInventoryQuantities } from "../features/inventory-counts/services/shopify-inventory.server";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

function formatVariance(variance) {
  return variance > 0 ? `+${variance}` : String(variance);
}

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const count = params.countId
    ? await getInventoryCount(session.shop, params.countId)
    : null;

  if (!count) {
    throw new Response("Inventory count not found.", { status: 404 });
  }

  const progress = calculateCountProgress(count.lines);

  return {
    count: {
      ...count,
      countNumber: formatInventoryCountNumber(count.countNumber),
      progress,
      variance: calculateVariance(
        progress.quantityCounted,
        progress.totalQuantity,
      ),
    },
    initialRefreshFailed:
      new URL(request.url).searchParams.get("reviewRefresh") === "failed",
  };
};

export const action = async ({ request, params }) => {
  const { admin, session, redirect } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const countId = params.countId;
  if (!countId) return { error: "Inventory count not found." };
  try {
    if (intent === "refresh-shopify-inventory") {
      const count = await getInventoryCount(session.shop, countId);
      if (!count) return { error: "Inventory count not found." };
      if (count.status !== "REVIEW") {
        return { error: "This count is no longer in review." };
      }
      let quantities;
      try {
        quantities = await getCurrentInventoryQuantities(
          admin,
          count.locationId,
          count.lines.map((line) => line.inventoryItemId),
        );
      } catch (shopifyError) {
        console.error("Manual Shopify review inventory refresh failed", {
          shop: session.shop,
          countId,
          message: shopifyError.message,
        });
        return {
          error:
            "Shopify quantities could not be refreshed. Any previous review snapshot was preserved; please try again.",
        };
      }
      await refreshReviewInventory({
        shop: session.shop,
        countId,
        quantities,
      });
      return { message: "Shopify quantities refreshed." };
    }
    if (intent === "continue" || intent === "return-to-counting") {
      await transitionInventoryCount({
        shop: session.shop,
        countId,
        transition: "continue",
      });
      return redirect(`/app/inventory-counts/${countId}/count`);
    }
    if (intent === "complete") {
      if (formData.get("confirmComplete") !== "yes") {
        return {
          error: "Confirm completion without changing Shopify inventory.",
        };
      }
      await transitionInventoryCount({
        shop: session.shop,
        countId,
        transition: "complete",
      });
      return redirect(`/app/inventory-counts/${countId}`);
    }
    return { error: "Choose a valid inventory count action." };
  } catch (error) {
    return { error: friendlyWorkflowError(error) };
  }
};

export default function InventoryCountDetailPage() {
  const { count, initialRefreshFailed } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();

  return (
    <s-page heading={`Count: ${count.countNumber}`}>
      {count.status === "REVIEW" ? (
        <>
          <s-button
            slot="secondary-actions"
            onClick={() =>
              document
                .getElementById("refresh-shopify-form")
                ?.requestSubmit()
            }
          >
            Refresh Shopify Quantities
          </s-button>
          <Form method="post" id="refresh-shopify-form" hidden>
            <input
              type="hidden"
              name="intent"
              value="refresh-shopify-inventory"
            />
          </Form>
          <s-button
            slot="secondary-actions"
            onClick={() =>
              document
                .getElementById("return-to-counting-form")
                ?.requestSubmit()
            }
          >
            Return to Counting
          </s-button>
          <Form method="post" id="return-to-counting-form" hidden>
            <input type="hidden" name="intent" value="return-to-counting" />
          </Form>
          <s-button
            slot="secondary-actions"
            onClick={() => navigate("/app/inventory-counts")}
          >
            Back to Counts
          </s-button>
        </>
      ) : (
        <s-button
          slot="secondary-actions"
          onClick={() => navigate("/app/inventory-counts")}
        >
          Back to Counts
        </s-button>
      )}
      {count.status === "DRAFT" && (
        <>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() =>
              document.getElementById("continue-counting-form")?.requestSubmit()
            }
          >
            Continue Counting
          </s-button>
          <Form method="post" id="continue-counting-form" hidden>
            <input type="hidden" name="intent" value="continue" />
          </Form>
        </>
      )}
      {count.status === "COUNTING" && (
        <s-button
          slot="primary-action"
          variant="primary"
          onClick={() =>
            navigate(`/app/inventory-counts/${count.id}/count`)
          }
        >
          Continue Counting
        </s-button>
      )}
      {actionData?.error && (
        <s-banner tone="critical">{actionData.error}</s-banner>
      )}
      {initialRefreshFailed && !actionData?.message && !actionData?.error && (
        <s-banner tone="critical">
          Shopify quantities could not be refreshed. The count remains in review; try again below.
        </s-banner>
      )}
      {actionData?.message && (
        <s-banner tone="success">{actionData.message}</s-banner>
      )}

      <s-section heading="Count summary">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="large">
            <s-text>
              Status: <s-badge>{count.status}</s-badge>
            </s-text>
            <s-badge>Read-only preview</s-badge>
            <s-text>Location: {count.locationName}</s-text>
            <s-text>Area: {count.area}</s-text>
            <s-text>Employee: {count.createdBy || "Not assigned"}</s-text>
            <s-text>Count Type: {count.countType === "BLANK_SCAN" ? "Blank Scan" : "Product Type"}</s-text>
          </s-stack>
          {count.countType === "PRODUCT_TYPE" && <s-text>
            Product types:{" "}
            {count.productTypes.includes("__ALL__")
              ? "All product types"
              : count.productTypes
                  .map((type) =>
                    type === "__UNCATEGORIZED__" ? "Uncategorized" : type,
                  )
                  .join(", ")}
          </s-text>}
          <div className={detailStyles.timestamps}>
            <s-text>Started: {formatDateTime(count.startedAt)}</s-text>
            <s-text>
              Refreshed: {formatDateTime(count.reviewInventoryRefreshedAt)}
            </s-text>
            <s-text>Completed: {formatDateTime(count.completedAt)}</s-text>
          </div>
          <s-stack direction="inline" gap="large">
            <s-text>{count.countType === "BLANK_SCAN" ? `Unique variants added: ${count.progress.totalProducts}` : `Products: ${count.progress.productsCounted} of ${count.progress.totalProducts}`}</s-text>
            <s-text>{count.countType === "BLANK_SCAN" ? `Total physically counted quantity: ${count.progress.quantityCounted}` : `Quantity: ${count.progress.quantityCounted} of ${count.progress.totalQuantity}`}</s-text>
            {count.countType === "BLANK_SCAN" && <s-text>Total Shopify starting quantity: {count.progress.totalQuantity}</s-text>}
            <s-text>Variance: {formatVariance(count.variance)}</s-text>
          </s-stack>
        </s-stack>
      </s-section>

      {count.status === "REVIEW" && (
        <s-section heading="Complete Count">
          <s-stack direction="block" gap="base">
            <Form method="post">
              <input type="hidden" name="intent" value="complete" />
              <label>
                <input
                  type="checkbox"
                  name="confirmComplete"
                  value="yes"
                  required
                />{" "}
                Confirm completion without changing Shopify inventory
              </label>
              <div style={{ marginTop: 12 }}>
                <s-button variant="primary" type="submit">
                  Complete without changing Shopify inventory
                </s-button>
              </div>
            </Form>
            <s-button disabled>
              Complete and apply approved inventory adjustments
            </s-button>
            <s-text>
              Shopify inventory adjustments are not available yet.
            </s-text>
          </s-stack>
        </s-section>
      )}

      <s-section heading="Products">
        {count.lines.length === 0 ? (
          <s-paragraph>No products in this inventory count.</s-paragraph>
        ) : (
          <CountLinesTable lines={count.lines} countStatus={count.status} />
        )}
      </s-section>

      <s-section heading="Notes">
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-paragraph className={detailStyles.notes}>
            {count.notes?.trim() || "No notes added."}
          </s-paragraph>
        </s-box>
      </s-section>

    </s-page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <s-page heading="Inventory count not found">
        <s-section>
          <s-paragraph>Inventory count not found.</s-paragraph>
          <s-button onClick={() => navigate("/app/inventory-counts")}>
            Back to Inventory Counts
          </s-button>
        </s-section>
      </s-page>
    );
  }

  return boundary.error(error);
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
