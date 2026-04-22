import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClientWithAuth, requireJwt } from "../_shared/privileged_gateway.ts";
import { logUserAction } from "../_shared/audit_logger.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body = {
  query?: string;
};

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 30, perHour: 300 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    const body = (await req.json().catch(() => ({}))) as Body;
    const query = String(body.query ?? "").trim();
    if (query.length < 3) return validationErrorResponse("query must be at least 3 characters", cors);

    // Permission gate: `support_lookup_user` already enforces `is_support_or_admin()`
    const authedPriv = createPrivilegedClientWithAuth(authHeader ?? "");
    const { data, error } = await authedPriv.rpc("support_lookup_user", { p_email: `%${query}%` });
    if (error) throw error;

    await logUserAction({
      actorUserId,
      actionType: "support:users:search",
      actionDescription: "Support searched users via support panel API",
      ipAddress,
      userAgent,
      metadata: { query, result_count: Array.isArray(data) ? data.length : 0 },
    });

    // SECURITY: return only the safe view fields from RPC (it already uses safe email accessor).
    return json({ success: true, users: data ?? [] }, 200, cors);
  } catch (err) {
    return safeErrorResponse(err, "[support-users-search]", cors);
  }
});

