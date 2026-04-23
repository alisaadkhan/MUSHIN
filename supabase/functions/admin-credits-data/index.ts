import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, requireSystemAdmin } from "../_shared/privileged_gateway.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body = { action: "list_balances"; limit_workspaces?: number; limit_balances?: number };

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
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 20, perHour: 120 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    await requireSystemAdmin(authHeader);
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const limitW = Math.max(1, Math.min(Number(body.limit_workspaces ?? 2000), 5000));
    const limitB = Math.max(1, Math.min(Number(body.limit_balances ?? 20000), 100000));

    const client = createPrivilegedClient();
    const [wsRes, balRes] = await Promise.all([
      client.from("workspaces").select("id,owner_id,plan").limit(limitW),
      client.from("user_credit_balances").select("user_id,workspace_id,credit_type,balance").limit(limitB),
    ]);

    if (wsRes.error) throw wsRes.error;
    if (balRes.error) throw balRes.error;

    return json({ success: true, workspaces: wsRes.data ?? [], balances: balRes.data ?? [] }, 200, cors);
  } catch (err) {
    return safeErrorResponse(err, "[admin-credits-data]", cors);
  }
});

