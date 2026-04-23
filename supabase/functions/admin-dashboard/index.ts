import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, requireSystemAdmin } from "../_shared/privileged_gateway.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";
import { requireJwt } from "../_shared/privileged_gateway.ts";

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
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 20, perHour: 200 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    await requireSystemAdmin(authHeader);
    const client = createPrivilegedClient();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();

    const [subsRes, wsRes, auditRes, suspendedRes, creditTodayRes, profilesRes] = await Promise.all([
      client.from("subscriptions").select("id,plan,status"),
      client.from("workspaces").select("id", { count: "exact", head: true }),
      client
        .from("system_audit_logs")
        .select("id,timestamp,action_type,action_description,actor_user_id")
        .order("timestamp", { ascending: false })
        .limit(8),
      client.from("user_suspensions").select("id", { count: "exact", head: true }).is("lifted_at", null),
      client.from("credit_transactions").select("id", { count: "exact", head: true }).gte("created_at", startIso),
      client.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    if (subsRes.error) throw subsRes.error;
    if (wsRes.error) throw wsRes.error;
    if (auditRes.error) throw auditRes.error;
    if (suspendedRes.error) throw suspendedRes.error;
    if (creditTodayRes.error) throw creditTodayRes.error;
    if (profilesRes.error) throw profilesRes.error;

    const activeSubs = (subsRes.data ?? []).filter((s: any) => s.status === "active").length;

    await logAdminAction({
      actorUserId,
      actionType: "admin:dashboard:view",
      actionDescription: "Admin viewed dashboard stats",
      ipAddress,
      userAgent,
    });

    return json(
      {
        success: true,
        totalUsers: Number(profilesRes.count ?? 0),
        activeUsers7d: 0,
        activeSubs,
        totalSubs: (subsRes.data ?? []).length,
        totalWorkspaces: Number(wsRes.count ?? 0),
        recentAuditActions: auditRes.data ?? [],
        suspendedUsers: Number(suspendedRes.count ?? 0),
        creditEventsToday: Number(creditTodayRes.count ?? 0),
        lastUpdatedAt: new Date().toISOString(),
      },
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, "[admin-dashboard]", cors);
  }
});

