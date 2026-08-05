import {
  isRouteErrorResponse,
  useLoaderData,
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

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatCountNumber(count) {
  const numericName = count.name.match(/\d+/)?.[0];

  if (numericName) {
    return numericName.padStart(3, "0");
  }

  const idNumber = [...count.id].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 1000,
    0,
  );

  return String(idNumber).padStart(3, "0");
}

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
      countNumber: formatCountNumber(count),
      progress,
      variance: calculateVariance(
        progress.quantityCounted,
        progress.totalQuantity,
      ),
    },
  };
};

export default function InventoryCountDetailPage() {
  const { count } = useLoaderData();

  return (
    <s-page heading={`Count: ${count.countNumber}`}>
      <s-link href="/app/inventory-counts">Back to Inventory Counts</s-link>

      <s-section heading="Count summary">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="large">
            <s-text>
              Status: <s-badge>{count.status}</s-badge>
            </s-text>
            <s-badge>Read-only preview</s-badge>
            <s-text>Location: {count.locationName}</s-text>
            <s-text>Employee: {count.createdBy || "Not assigned"}</s-text>
          </s-stack>
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

      <s-section heading="Actions">
        <s-stack direction="inline" gap="base">
          <s-button variant="primary" disabled>
            Continue Counting
          </s-button>
          <s-button disabled>Export CSV</s-button>
        </s-stack>
      </s-section>

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
          <s-link href="/app/inventory-counts">
            Back to Inventory Counts
          </s-link>
        </s-section>
      </s-page>
    );
  }

  return boundary.error(error);
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
