import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { redirect } = await authenticate.admin(request);

  return redirect("/app/inventory-counts");
};

export default function AppIndex() {
  return null;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
