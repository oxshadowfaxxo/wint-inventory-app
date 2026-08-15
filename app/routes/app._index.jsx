import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  console.log("APP INDEX LOADER HIT", {
    shop: session.shop,
    url: request.url,
  });

  return null;
};

export default function AppIndex() {
  return (
    <s-page heading="App Index Test">
      <s-section>
        APP INDEX LOADED
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};