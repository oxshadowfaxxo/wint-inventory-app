import { Outlet, useLoaderData, useLocation, useParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { AllCountsTable } from "../features/inventory-counts/components/AllCountsTable";
import { getInventoryCounts } from "../features/inventory-counts/services/inventory-counts.server";
import {
  friendlyWorkflowError,
  setInventoryCountArchived,
} from "../features/inventory-counts/services/inventory-count-workflow.server";
import {
  calculateCountProgress,
  calculateVariance,
  getLastActivity,
} from "../features/inventory-counts/utils/inventory-count-progress";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const counts = await getInventoryCounts(session.shop);
  return {
    counts: counts.map((count) => {
      const progress = calculateCountProgress(count.lines);
      return {
        ...count,
        progress,
        variance: calculateVariance(progress.quantityCounted, progress.totalQuantity),
        lastActivity: getLastActivity(count),
        lines: undefined,
        scanEvents: undefined,
      };
    }),
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");
  const countId = String(formData.get("countId") || "");
  try {
    if (!countId) return { error: "Inventory count not found." };
    if (intent !== "archive" && intent !== "unarchive") {
      return { error: "Choose a valid archive action." };
    }
    await setInventoryCountArchived({
      shop: session.shop,
      countId,
      archived: intent === "archive",
    });
    return { success: true };
  } catch (error) {
    return { error: friendlyWorkflowError(error) };
  }
};

export default function InventoryCountsPage() {
  const { countId } = useParams();
  const location = useLocation();
  const { counts } = useLoaderData();

  if (countId || location.pathname.endsWith("/new")) return <Outlet />;

  return (
    <s-page heading="Inventory Counts">
      <s-button slot="primary-action" variant="primary" href="/app/inventory-counts/new">New Count</s-button>
      <s-section heading="All Counts">
        <AllCountsTable counts={counts} />
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
