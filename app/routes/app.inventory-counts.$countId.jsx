import {
  Form,
  Outlet,
  redirect,
  isRouteErrorResponse,
  useActionData,
  useLoaderData,
  useLocation,
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
  transitionInventoryCount,
} from "../features/inventory-counts/services/inventory-count-workflow.server";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : "Not started";
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
  };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const countId = params.countId;
  if (!countId) return { error: "Inventory count not found." };
  try {
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
  const { count } = useLoaderData();
  const actionData = useActionData();
  const location = useLocation();

  if (location.pathname.endsWith("/count")) return <Outlet />;

  return (
    <s-page heading={`Count: ${count.countNumber}`}>
      <s-button slot="secondary-actions" href="/app/inventory-counts">
        Back to Counts
      </s-button>
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
          href={`/app/inventory-counts/${count.id}/count`}
        >
          Continue Counting
        </s-button>
      )}
      {actionData?.error && (
        <s-banner tone="critical">{actionData.error}</s-banner>
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
          </s-stack>
          <s-text>
            Product types:{" "}
            {count.productTypes.includes("__ALL__")
              ? "All product types"
              : count.productTypes
                  .map((type) =>
                    type === "__UNCATEGORIZED__" ? "Uncategorized" : type,
                  )
                  .join(", ")}
          </s-text>
          <s-stack direction="inline" gap="large">
            <s-text>Started: {formatDateTime(count.startedAt)}</s-text>
            {count.completedAt && (
              <s-text>Completed: {formatDateTime(count.completedAt)}</s-text>
            )}
          </s-stack>
          <s-stack direction="inline" gap="large">
            <s-text>
              Products: {count.progress.productsCounted} of{" "}
              {count.progress.totalProducts}
            </s-text>
            <s-text>
              Quantity: {count.progress.quantityCounted} of{" "}
              {count.progress.totalQuantity}
            </s-text>
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
            <Form method="post">
              <input type="hidden" name="intent" value="return-to-counting" />
              <s-button type="submit">Return to counting</s-button>
            </Form>
          </s-stack>
        </s-section>
      )}

      <s-section heading="Products">
        {count.lines.length === 0 ? (
          <s-paragraph>No products in this inventory count.</s-paragraph>
        ) : (
          <CountLinesTable lines={count.lines} />
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

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <s-page heading="Inventory count not found">
        <s-section>
          <s-paragraph>Inventory count not found.</s-paragraph>
          <s-link href="/app/inventory-counts">Back to Inventory Counts</s-link>
        </s-section>
      </s-page>
    );
  }

  return boundary.error(error);
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
