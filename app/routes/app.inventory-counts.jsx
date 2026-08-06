import { Outlet, useLoaderData, useLocation, useParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  CurrentCountRow,
  CurrentCountsHeader,
} from "../features/inventory-counts/components/CurrentCountRow";
import { CountHistoryRow } from "../features/inventory-counts/components/CountHistoryRow";
import currentCountStyles from "../features/inventory-counts/components/current-counts.module.css";
import { getInventoryCounts } from "../features/inventory-counts/services/inventory-counts.server";
import {
  calculateCountProgress,
  calculateVariance,
  getLastActivity,
} from "../features/inventory-counts/utils/inventory-count-progress";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { currentCounts, historyCounts } = await getInventoryCounts(
    session.shop,
  );

  return {
    currentCounts: currentCounts.map((count) => ({
      ...count,
      progress: calculateCountProgress(count.lines),
      lastActivity: getLastActivity(count),
      lines: undefined,
      scanEvents: undefined,
    })),
    historyCounts: historyCounts.map((count) => {
      const progress = calculateCountProgress(count.lines);

      return {
        ...count,
        progress,
        variance: calculateVariance(
          progress.quantityCounted,
          progress.totalQuantity,
        ),
        lines: undefined,
        scanEvents: undefined,
      };
    }),
  };
};

export default function InventoryCountsPage() {
  const { countId } = useParams();
  const location = useLocation();
  const { currentCounts, historyCounts } = useLoaderData();

  if (countId || location.pathname.endsWith("/new")) {
    return <Outlet />;
  }

  return (
    <s-page heading="Inventory Counts">
      <s-section>
        <s-stack direction="inline" gap="base">
          <s-button disabled>Search</s-button>
          <s-button variant="primary" href="/app/inventory-counts/new">
            New Count
          </s-button>
        </s-stack>
      </s-section>

      <s-section heading="Current Counts">
        {currentCounts.length === 0 ? (
          <s-paragraph>No current inventory counts.</s-paragraph>
        ) : (
          <div className={currentCountStyles.table}>
            <CurrentCountsHeader />
            {currentCounts.map((count) => (
              <CurrentCountRow key={count.id} count={count} />
            ))}
          </div>
        )}
      </s-section>

      <s-section heading="Count History">
        {historyCounts.length === 0 ? (
          <s-paragraph>No inventory count history.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {historyCounts.map((count) => (
              <CountHistoryRow key={count.id} count={count} />
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
