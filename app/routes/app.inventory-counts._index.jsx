import { useLoaderData, useNavigate } from "react-router";
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
  const countIds = [
    ...new Set(formData.getAll("countId").map(String).filter(Boolean)),
  ];
  try {
    if (countIds.length === 0) {
      return { error: "Select at least one inventory count." };
    }
    if (intent !== "archive" && intent !== "unarchive") {
      return { error: "Choose a valid archive action." };
    }
    for (const countId of countIds) {
      await setInventoryCountArchived({
        shop: session.shop,
        countId,
        archived: intent === "archive",
      });
    }
    return { success: true };
  } catch (error) {
    return { error: friendlyWorkflowError(error) };
  }
};

export default function InventoryCountsPage() {
  const { counts } = useLoaderData();
  const navigate = useNavigate();

  return (
    <s-page heading="Inventory Counts">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/inventory-counts/new")}
      >
        New Count
      </s-button>
      <s-section heading="All Counts">
        <AllCountsTable counts={counts} />
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
