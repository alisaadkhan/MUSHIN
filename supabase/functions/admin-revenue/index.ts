import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, requireSystemAdmin, requireJwt } from "../_shared/privileged_gateway.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

const PLAN_PRICE_PKR: Record<string, number> = {
  pro: 4999,
  business: 14999,
  enterprise: 39999,
};

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 15, perHour: 120 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    await requireSystemAdmin(authHeader);

    const client = createPrivilegedClient();
    const { data: subs, error } = await client
      .from("paddle_subscriptions")
      .select("user_id,plan_name,status,current_period_end,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    const active = (subs ?? []).filter((s: any) => String(s.status).toLowerCase() === "active");
    const byPlan: Record<string, number> = {};
    for (const s of active) {
      const k = String((s as any).plan_name ?? "unknown").toLowerCase();
      byPlan[k] = (byPlan[k] ?? 0) + 1;
    }

    const mrrPkr = Object.entries(byPlan).reduce((sum, [plan, count]) => sum + (PLAN_PRICE_PKR[plan] ?? 0) * count, 0);

    await logAdminAction({
      actorUserId,
      actionType: "admin:revenue:view",
      actionDescription: "Admin viewed revenue panel",
      ipAddress,
      userAgent,
    });

    return json(
      {
        success: true,
        activeCount: active.length,
        byPlan,
        mrrPkr,
        subs: active.map((s: any) => ({ user_id: s.user_id, plan_name: s.plan_name, status: s.status, current_period_end: s.current_period_end, email: null })),
      },
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, "[admin-revenue]", cors);
  }
});

