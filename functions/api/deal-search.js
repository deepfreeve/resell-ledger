import { authenticatedUser, jsonResponse, readJson } from "./_shared.js";

async function getEbayToken(env) {
  const credentials = btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`);
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope"
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error("eBay token unavailable");
  return result.access_token;
}

export async function onRequestPost({ request, env }) {
  if (env.ENABLE_EBAY_DEAL_SEARCH !== "true") return jsonResponse({ error: "eBay deal search is not enabled for this CACHE deployment." }, 503);
  if (!(await authenticatedUser(request, env))) return jsonResponse({ error: "Sign in again before searching eBay." }, 401);
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) return jsonResponse({ error: "The owner needs to configure eBay Browse API credentials in Cloudflare Pages settings." }, 503);
  let input;
  try { input = await readJson(request, 10_000); } catch { return jsonResponse({ error: "Invalid search request." }, 400); }
  const query = typeof input?.query === "string" ? input.query.trim().slice(0, 100) : "";
  if (query.length < 2) return jsonResponse({ error: "Enter a search with at least two characters." }, 400);
  const limit = Math.max(1, Math.min(40, Number(input.limit) || 40));
  const marketplace = typeof input.marketplace === "string" && /^[A-Z0-9_]{4,20}$/.test(input.marketplace) ? input.marketplace : "EBAY_US";
  try {
    const token = await getEbayToken(env);
    const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(limit));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": marketplace } });
    const result = await response.json();
    if (!response.ok) return jsonResponse({ error: "eBay could not complete the listing search. Check API access and search settings." }, 502);
    const items = (result.itemSummaries || []).map((item) => ({ id: item.itemId, title: item.title || "Untitled listing", price: Number(item.price?.value) || 0, shipping: Number(item.shippingOptions?.[0]?.shippingCost?.value) || 0, condition: item.condition || "", url: item.itemWebUrl || "", imageUrl: item.image?.imageUrl || "" })).filter((item) => item.url && item.price >= 0);
    return jsonResponse({ items, source: "eBay Browse active listings" });
  } catch {
    return jsonResponse({ error: "Could not connect to eBay Browse API. Check eBay credentials and access." }, 502);
  }
}
