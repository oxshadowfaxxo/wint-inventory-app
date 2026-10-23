import { useEffect, useState } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigate,
} from "react-router";
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
  refreshReviewInventory,
} from "../features/inventory-counts/services/inventory-count-workflow.server";
import {
  getCurrentInventoryQuantities,
  getShopifyVariantForAddition,
  getShopifyVariantByExactBarcode,
  searchShopifyVariants,
} from "../features/inventory-counts/services/shopify-inventory.server";
import { formatInventoryCountNumber } from "../features/inventory-counts/utils/inventory-count-number";

export const loader = async ({ request, params }) => {
  const { session, redirect } = await authenticate.admin(request);
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
  const { admin, session, redirect } = await authenticate.admin(request);
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
        const count = await getInventoryCount(session.shop, countId);
        if (!count || count.status !== "COUNTING") {
          return { error: "This count is not in counting mode.", barcode, scanError: true };
        }
        const scan = await scanInventoryCountBarcode({
          shop: session.shop,
          countId,
          barcode,
          findShopifyVariant: (exactBarcode) =>
            getShopifyVariantByExactBarcode(admin, count.locationId, exactBarcode),
        });
        return { scan };
      } catch (error) {
        if (error.code === "BARCODE_NOT_FOUND" || error.userMessage) {
          return {
            error: error.userMessage || error.message,
            barcode,
            scanError: true,
            barcodeErrorCode: error.code,
            matchingProducts: error.details,
          };
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
        notes: formData.has("notes") ? String(formData.get("notes")) : undefined,
      });
      return redirect(`/app/inventory-counts/${countId}`);
    }
    if (intent === "finish" || intent === "commit-and-finish") {
      const warning = await finishInventoryCount({
        shop: session.shop,
        countId,
        commitUncounted: intent === "commit-and-finish",
        notes: formData.has("notes") ? String(formData.get("notes")) : undefined,
      });
      if (warning) return { finishWarning: warning };
      try {
        const reviewCount = await getInventoryCount(session.shop, countId);
        if (!reviewCount || reviewCount.status !== "REVIEW") {
          throw new Error("The inventory count did not enter review.");
        }
        const quantities = await getCurrentInventoryQuantities(
          admin,
          reviewCount.locationId,
          reviewCount.lines.map((line) => line.inventoryItemId),
        );
        await refreshReviewInventory({ shop: session.shop, countId, quantities });
        return redirect(`/app/inventory-counts/${countId}?reviewRefresh=success`);
      } catch (refreshError) {
        console.error("Initial Shopify review inventory refresh failed", {
          shop: session.shop,
          countId,
          message: refreshError.message,
        });
        return redirect(`/app/inventory-counts/${countId}?reviewRefresh=failed`);
      }
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
  const navigate = useNavigate();
  // Keep local edits through scan/search revalidation, but not across counts.
  const [notesDraft, setNotesDraft] = useState({
    countId: count.id,
    value: count.notes ?? "",
  });
  if (notesDraft.countId !== count.id) {
    setNotesDraft({ countId: count.id, value: count.notes ?? "" });
  }
  const notes = notesDraft.countId === count.id ? notesDraft.value : count.notes ?? "";
  // Match the existing 50rem responsive convention. Remove desktop actions
  // from the DOM so App Bridge cannot retain a separate compact primary action.
  const [compactActions, setCompactActions] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 50rem)");
    const update = () => setCompactActions(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const continueCounting = () =>
    navigate(`/app/inventory-counts/${count.id}/count`, { replace: true });

  return (
    <s-page heading={`Count: ${count.displayNumber}`}>
      <s-badge slot="accessory" tone="info">
        COUNTING
      </s-badge>
      {compactActions ? (
        <>
          <s-button
            slot="secondary-actions"
            icon="menu-horizontal"
            accessibilityLabel="Count actions"
            commandFor="count-actions-menu"
          />
          <s-menu id="count-actions-menu" accessibilityLabel="Count actions">
            <s-section>
              {actionData?.finishWarning && (
                <s-button onClick={continueCounting}>Continue Counting</s-button>
              )}
              <s-button
                onClick={() =>
                  document.getElementById("save-count-form")?.requestSubmit()
                }
              >
                Save &amp; Quit
              </s-button>
            </s-section>
            <s-section>
              <s-button
                onClick={() =>
                  document.getElementById("finish-count-form")?.requestSubmit()
                }
              >
                Finish Counting
              </s-button>
            </s-section>
          </s-menu>
        </>
      ) : (
        <>
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
        </>
      )}
      <Form method="post" id="save-count-form" hidden>
        <input type="hidden" name="intent" value="save" />
        <input type="hidden" name="notes" value={notes} />
      </Form>
      <Form method="post" id="finish-count-form" hidden>
        <input type="hidden" name="intent" value="finish" />
        <input type="hidden" name="notes" value={notes} />
      </Form>
      {actionData?.error && (
        <s-banner tone="critical">
          <s-stack direction="block" gap="small">
            <span>{actionData.error}</span>
            {actionData.matchingProducts?.length > 0 && (
              <s-unordered-list>
                {actionData.matchingProducts.map((item, index) => (
                  <s-list-item key={`${item.productTitle}-${item.sku}-${index}`}>
                    {item.productTitle}{item.variantTitle ? ` — ${item.variantTitle}` : ""} — SKU: {item.sku || "—"}
                  </s-list-item>
                ))}
              </s-unordered-list>
            )}
          </s-stack>
        </s-banner>
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
            <input type="hidden" name="notes" value={notes} />
            <s-stack direction="inline" gap="base">
              {!compactActions && (
                <s-button onClick={continueCounting}>
                  Go Back and Continue Counting
                </s-button>
              )}
              <s-button variant="primary" type="submit">
                Commit Uncounted Items and Finish
              </s-button>
            </s-stack>
          </Form>
        </s-section>
      )}

      <s-section heading="Products">
        <CountingProductsTable countId={count.id} countType={count.countType} lines={count.lines} />
      </s-section>

      <AddProductSearch
        countId={count.id}
        existingVariantIds={count.lines.map((line) => line.variantId)}
      />

      <s-section heading="Notes">
        <s-text-area
          label="Notes"
          labelAccessibilityVisibility="exclusive"
          rows={4}
          value={notes}
          onInput={(event) =>
            setNotesDraft({ countId: count.id, value: event.currentTarget.value })
          }
        />
      </s-section>

    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
