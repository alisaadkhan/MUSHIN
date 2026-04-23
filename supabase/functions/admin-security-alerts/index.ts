import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, requireSystemAdmin } from "../_shared/privileged_gateway.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body = { limit?: number };

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 30, perHour: 300 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    await requireSystemAdmin(authHeader);
    const body = (await req.json().catch(() => ({}))) as Body;
    const limit = Math.max(1, Math.min(Number(body.limit ?? 200), 500));

    const client = createPrivilegedClient();
    const { data, error } = await client
      .from("security_alerts")
      .select("id,created_at,severity,category,user_id,workspace_id,ip_address,metadata")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return json({ success: true, alerts: data ?? [] }, 200, cors);
  } catch (err) {
    return safeErrorResponse(err, "[admin-security-alerts]", cors);
  }
});

