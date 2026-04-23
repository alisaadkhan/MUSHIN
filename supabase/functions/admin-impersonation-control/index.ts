import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, isSuperAdmin, requireJwt } from "../_shared/privileged_gateway.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body =
  | { action: "list"; status?: "active" | "all"; limit?: number }
  | { action: "revoke"; session_id: string; reason: string }
  | { action: "extend"; session_id: string; minutes: number; reason: string };

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function reqReason(reason: unknown) {
  const r = String(reason ?? "").trim();
  if (r.length < 10) throw new Error("reason_required");
  return r.slice(0, 400);
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 20, perHour: 120 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    if (!(await isSuperAdmin(actorUserId))) return json({ error: "Forbidden" }, 403, cors);

    const body = (await req.json().catch(() => ({}))) as Body;
    const client = createPrivilegedClient();

    if (body.action === "list") {
      const limit = Math.max(1, Math.min(Number(body.limit ?? 200), 500));
      const status = body.status ?? "active";
      const nowIso = new Date().toISOString();

      let q = client
        .from("impersonation_sessions")
        .select("id,support_user_id,target_user_id,reason,created_at,expires_at,revoked_at,revoked_by,revoked_reason")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status === "active") {
        q = q.is("revoked_at", null).gt("expires_at", nowIso);
      }

      const { data, error } = await q;
      if (error) throw error;

      // Enrich with computed status + action_count (best-effort) from user_activity_logs in the window.
      const sessions = (data ?? []) as any[];
      const enriched = await Promise.all(
        sessions.map(async (s) => {
          const now = Date.now();
          const start = new Date(s.created_at).getTime();
          const end = s.revoked_at ? new Date(s.revoked_at).getTime() : Math.min(new Date(s.expires_at).getTime(), now);
          const duration_seconds = Math.max(0, Math.floor((end - start) / 1000));
          const computed_status = s.revoked_at ? "revoked" : new Date(s.expires_at).getTime() <= now ? "expired" : "active";
          let action_count = 0;
          try {
            const { count } = await client
              .from("user_activity_logs")
              .select("id", { count: "exact", head: true })
              .eq("user_id", s.target_user_id)
              .gte("created_at", s.created_at)
              .lte("created_at", s.expires_at);
            action_count = Number(count ?? 0);
          } catch {
            action_count = 0;
          }

          // actions performed (from system audit logs), grouped by action_type with counts.
          let actions_summary: Array<{ action_type: string; count: number }> = [];
          try {
            const startIso = new Date(s.created_at).toISOString();
            const endIso = new Date(
              s.revoked_at
                ? Math.min(new Date(s.revoked_at).getTime(), new Date(s.expires_at).getTime())
                : new Date(s.expires_at).getTime(),
            ).toISOString();

            const { data: rows, error: aErr } = await client
              .from("system_audit_logs")
              .select("action_type,timestamp")
              .eq("actor_user_id", s.target_user_id)
              .gte("timestamp", startIso)
              .lte("timestamp", endIso)
              .order("timestamp", { ascending: false })
              .limit(200);
            if (aErr) throw aErr;
            const counts: Record<string, number> = {};
            for (const r of rows ?? []) {
              const t = String((r as any).action_type ?? "");
              if (!t) continue;
              counts[t] = (counts[t] ?? 0) + 1;
            }
            actions_summary = Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 15)
              .map(([action_type, count]) => ({ action_type, count }));
          } catch {
            actions_summary = [];
          }
          return { ...s, computed_status, duration_seconds, action_count, actions_summary };
        }),
      );

      return json({ success: true, sessions: enriched }, 200, cors);
    }

    if (body.action === "revoke") {
      const id = String(body.session_id ?? "").trim();
      if (!id) return validationErrorResponse("session_id required", cors);
      const reason = reqReason(body.reason);

      const { data: row, error } = await client
        .from("impersonation_sessions")
        .update({
          revoked_at: new Date().toISOString(),
          revoked_by: actorUserId,
          revoked_reason: reason,
        })
        .eq("id", id)
        .is("revoked_at", null)
        .select("id,target_user_id,support_user_id,expires_at")
        .single();
      if (error) throw error;

      // Best effort: invalidate refresh tokens for the impersonated user, forcing session end on refresh.
      try {
        await client.auth.admin.invalidateUserRefreshTokens(row.target_user_id);
      } catch {
        // ignore; still auditable
      }

      await logAdminAction({
        actorUserId,
        targetUserId: row.target_user_id,
        actionType: "superadmin:impersonation:revoke",
        actionDescription: "Super admin revoked impersonation session",
        ipAddress,
        userAgent,
        metadata: { session_id: id, reason },
      });

      return json({ success: true }, 200, cors);
    }

    if (body.action === "extend") {
      const id = String(body.session_id ?? "").trim();
      if (!id) return validationErrorResponse("session_id required", cors);
      const reason = reqReason(body.reason);
      const minutes = Math.max(1, Math.min(Number(body.minutes ?? 0), 60));

      const { data: existing, error: getErr } = await client
        .from("impersonation_sessions")
        .select("id,target_user_id,support_user_id,expires_at,revoked_at")
        .eq("id", id)
        .single();
      if (getErr) throw getErr;
      if (existing.revoked_at) return json({ error: "Already revoked" }, 409, cors);

      const newExp = new Date(new Date(existing.expires_at).getTime() + minutes * 60 * 1000).toISOString();
      const { error: upErr } = await client
        .from("impersonation_sessions")
        .update({ expires_at: newExp })
        .eq("id", id);
      if (upErr) throw upErr;

      await logAdminAction({
        actorUserId,
        targetUserId: existing.target_user_id,
        actionType: "superadmin:impersonation:extend",
        actionDescription: "Super admin extended impersonation session",
        ipAddress,
        userAgent,
        metadata: { session_id: id, minutes, new_expires_at: newExp, reason },
      });

      return json({ success: true, expires_at: newExp }, 200, cors);
    }

    return validationErrorResponse("Invalid action", cors);
  } catch (err) {
    return safeErrorResponse(err, "[admin-impersonation-control]", cors);
  }
});

