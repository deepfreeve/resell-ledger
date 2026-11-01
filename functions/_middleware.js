const NATIVE_APP_ORIGINS = new Set([
  "capacitor://localhost",
  "http://localhost",
  "https://localhost"
]);

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return context.next();

  const origin = request.headers.get("Origin") || "";
  const isNativeOrigin = NATIVE_APP_ORIGINS.has(origin);
  if (request.method === "OPTIONS" && isNativeOrigin) {
    return new Response(null, { status: 204, headers: nativeCorsHeaders(origin) });
  }

  const response = await context.next();
  if (!isNativeOrigin) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(nativeCorsHeaders(origin))) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function nativeCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, apikey, Content-Type, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
