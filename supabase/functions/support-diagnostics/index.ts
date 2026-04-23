import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClientWithAuth, requireJwt } from "../_shared/privileged_gateway.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { logUserAction } from "../_shared/audit_logger.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body = {
  target_user_id?: string;
  limit?: number;
};

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

const SENSITIVE_KEYS = ["authorization", "apikey", "api_key", "token", "access_token", "refresh_token", "secret", "password"];

function redact(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const lk = k.toLowerCase();
      if (SENSITIVE_KEYS.some((sk) => lk.includes(sk))) {
        out[k] = "[REDACTED]";
      } else if (typeof v === "string" && v.length > 2000) {
        out[k] = v.slice(0, 2000) + "…";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  if (typeof value === "string") {
    // Cheap token-like redaction
    if (/bearer\s+[a-z0-9\-\._~\+\/]+=*/i.test(value)) return "[REDACTED]";
  }
  return value;
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

    const { userId: supportUserId } = await requireJwt(authHeader);
    const body = (await req.json().catch(() => ({}))) as Body;
    const targetUserId = String(body.target_user_id ?? "").trim();
    if (!targetUserId) return validationErrorResponse("target_user_id required", cors);

    const limit = Math.max(10, Math.min(Number(body.limit ?? 200), 500));

    const authed = createPrivilegedClientWithAuth(authHeader ?? "");

    const { data: perms, error: permsErr } = await authed.rpc("get_my_support_permissions");
    if (permsErr) throw permsErr;

    const canViewActivityLogs = Boolean((perms as any)?.canViewActivityLogs);
    const canViewSessions = Boolean((perms as any)?.canViewSessions);
    const canViewBilling = Boolean((perms as any)?.canViewBilling);

    if (!canViewActivityLogs) return json({ error: "Forbidden" }, 403, cors);

    // 1) API failures (sanitized): user_activity_logs where status='error'
    const { data: failures, error: failErr } = await authed
      .from("user_activity_logs")
      .select("id,created_at,action_type,status,ip_address,device_info,metadata")
      .eq("user_id", targetUserId)
      .eq("status", "error")
      .order("created_at", { ascending: false })
      .limit(Math.min(200, limit));
    if (failErr) throw failErr;

    // 2) Activity timeline: user_activity_logs latest
    const { data: timeline, error: tlErr } = await authed
      .from("user_activity_logs")
      .select("id,created_at,action_type,status,ip_address,device_info,metadata")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(Math.min(300, limit));
    if (tlErr) throw tlErr;

    // 3) Credit usage (read-only): aggregate from credit_transactions if present
    let creditSeries: any[] = [];
    try {
      const { data: credits } = await authed
        .from("credit_transactions")
        .select("created_at, credit_type, amount")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(500);
      // series: last 30 by day
      const byDay: Record<string, Record<string, number>> = {};
      for (const row of credits ?? []) {
        const day = String(row.created_at).slice(0, 10);
        byDay[day] ||= {};
        const ct = String((row as any).credit_type ?? "unknown");
        byDay[day][ct] = (byDay[day][ct] ?? 0) + Number((row as any).amount ?? 0);
      }
      creditSeries = Object.entries(byDay)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .slice(-30)
        .map(([day, types]) => ({ day, types }));
    } catch {
      creditSeries = [];
    }

    // 4) AI usage summary: infer from activity logs action_type prefixes
    const aiCounts: Record<string, number> = {};
    for (const row of timeline ?? []) {
      const at = String((row as any).action_type ?? "");
      if (!at) continue;
      if (at.includes("ai") || at.startsWith("edge:ai") || at.startsWith("ai:")) {
        aiCounts[at] = (aiCounts[at] ?? 0) + 1;
      }
    }

    // Sessions/billing are privileged; keep gated (L2/admin_support only).
    let sessions: any[] = [];
    if (canViewSessions) {
      const { data, error } = await authed.rpc("support_get_user_sessions", { p_user_id: targetUserId });
      if (!error) sessions = data ?? [];
    }

    let billing: any = null;
    if (canViewBilling) {
      const { data, error } = await authed.rpc("support_get_user_billing_summary", { p_user_id: targetUserId, p_limit_invoices: 20 });
      if (!error) billing = data ?? null;
    }

    await logUserAction({
      actorUserId: supportUserId,
      targetUserId,
      actionType: "support:diagnostics:view",
      actionDescription: "Support viewed diagnostics panel",
      ipAddress,
      userAgent,
      metadata: { limit, canViewSessions, canViewBilling },
    });

    const sanitizeRows = (rows: any[]) =>
      (rows ?? []).map((r) => ({
        ...r,
        metadata: redact((r as any).metadata ?? {}),
      }));

    return json(
      {
        success: true,
        api_failures: sanitizeRows(failures ?? []),
        activity_timeline: sanitizeRows(timeline ?? []),
        credit_usage: creditSeries,
        ai_usage: aiCounts,
        sessions: canViewSessions ? sessions : [],
        billing: canViewBilling ? redact(billing) : null,
      },
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, "[support-diagnostics]", cors);
  }
});

