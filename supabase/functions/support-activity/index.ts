import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClientWithAuth, requireJwt } from "../_shared/privileged_gateway.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { logUserAction } from "../_shared/audit_logger.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body = {
  start?: string; // ISO
  end?: string; // ISO
  action_type?: string; // exact match or prefix (support:ticket)
  staff_id?: string; // actor_user_id
  limit?: number;
};

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function safeIso(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 40, perHour: 400 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    const body = (await req.json().catch(() => ({}))) as Body;

    const authed = createPrivilegedClientWithAuth(authHeader ?? "");

    // Tier-gated permission (server-side). Default deny.
    const { data: perms, error: permsErr } = await authed.rpc("get_my_support_permissions");
    if (permsErr) throw permsErr;
    const canView = Boolean((perms as any)?.canViewActivityLogs);
    if (!canView) return json({ error: "Forbidden" }, 403, cors);

    const start = safeIso(body.start);
    const end = safeIso(body.end);
    const actionType = String(body.action_type ?? "").trim();
    const staffId = String(body.staff_id ?? "").trim();
    const limit = Math.max(1, Math.min(Number(body.limit ?? 200), 500));

    let q = authed
      .from("system_audit_logs")
      .select("id,timestamp,actor_user_id,target_user_id,workspace_id,action_type,action_description,ip_address,user_agent,metadata_json")
      .like("action_type", "support:%")
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (start) q = q.gte("timestamp", start);
    if (end) q = q.lte("timestamp", end);
    if (staffId) q = q.eq("actor_user_id", staffId);
    if (actionType) {
      // Support action types are namespaced: support:table:op etc.
      q = actionType.includes("%") ? q.like("action_type", actionType) : q.like("action_type", `${actionType}%`);
    }

    const { data, error } = await q;
    if (error) throw error;

    await logUserAction({
      actorUserId,
      actionType: "support:activity:view",
      actionDescription: "Support viewed support activity panel",
      ipAddress,
      userAgent,
      metadata: { start, end, staff_id: staffId || null, action_type: actionType || null, limit },
    });

    return json({ success: true, rows: data ?? [] }, 200, cors);
  } catch (err) {
    if (err instanceof Error && err.message === "reason_required") {
      return validationErrorResponse("reason required", cors);
    }
    return safeErrorResponse(err, "[support-activity]", cors);
  }
});

