export async function authenticatedUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ") || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: env.SUPABASE_PUBLISHABLE_KEY }
  });
  return response.ok ? response.json() : null;
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function readJson(request, maximumBytes = 8_000_000) {
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > maximumBytes) throw new Error("Request is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) throw new Error("Request is too large.");
  return JSON.parse(text);
}
