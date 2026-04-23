import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClientWithAuth, requireJwt } from "../_shared/privileged_gateway.ts";

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  try {
    await requireJwt(authHeader);
    const authed = createPrivilegedClientWithAuth(authHeader ?? "");
    const { data, error } = await authed.rpc("get_my_support_permissions");
    if (error) throw error;
    return json({ success: true, permissions: data ?? { tier: null } }, 200, cors);
  } catch (err) {
    return safeErrorResponse(err, "[support-permissions]", cors);
  }
});

