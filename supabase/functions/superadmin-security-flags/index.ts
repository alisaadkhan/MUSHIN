import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, isSuperAdmin, requireJwt } from "../_shared/privileged_gateway.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body =
  | { action: "list_flags"; limit?: number }
  | { action: "run_detection"; window_minutes?: number; delete_threshold?: number }
  | { action: "support_activity"; limit?: number; target_user_id?: string; actor_user_id?: string };

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
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 20, perHour: 120 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    if (!(await isSuperAdmin(actorUserId))) return json({ error: "Forbidden" }, 403, cors);

    const body = (await req.json().catch(() => ({}))) as Body;
    const client = createPrivilegedClient();

    if (body.action === "list_flags") {
      const limit = Math.max(1, Math.min(Number(body.limit ?? 200), 500));
      const { data, error } = await client
        .from("security_flags")
        .select("id,flagged_at,actor_id,flag_type,severity,summary,evidence")
        .order("flagged_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json({ success: true, flags: data ?? [] }, 200, cors);
    }

    if (body.action === "run_detection") {
      const windowMinutes = Math.max(1, Math.min(Number(body.window_minutes ?? 10), 1440));
      const deleteThreshold = Math.max(1, Math.min(Number(body.delete_threshold ?? 25), 2000));
      const { data, error } = await client.rpc("flag_suspicious_activity", {
        p_window: `${windowMinutes} minutes`,
        p_delete_threshold: deleteThreshold,
      });
      if (error) throw error;

      await logAdminAction({
        actorUserId,
        actionType: "superadmin:security_flags:run_detection",
        actionDescription: "Super admin ran suspicious activity detection",
        ipAddress,
        userAgent,
        metadata: { window_minutes: windowMinutes, delete_threshold: deleteThreshold, result: data ?? null },
      });

      return json({ success: true, result: data }, 200, cors);
    }

    if (body.action === "support_activity") {
      const limit = Math.max(1, Math.min(Number(body.limit ?? 200), 500));
      const targetUserId = String((body as any).target_user_id ?? "").trim();
      const actorFilter = String((body as any).actor_user_id ?? "").trim();

      // SECURITY: allow only support-prefixed actions; never provide arbitrary query capability.
      let q = client
        .from("system_audit_logs")
        .select("id,timestamp,actor_user_id,target_user_id,workspace_id,action_type,action_description,ip_address,user_agent,metadata_json")
        .like("action_type", "support:%")
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (targetUserId) q = q.eq("target_user_id", targetUserId);
      if (actorFilter) q = q.eq("actor_user_id", actorFilter);

      const { data, error } = await q;
      if (error) throw error;

      return json({ success: true, activity: data ?? [] }, 200, cors);
    }

    return validationErrorResponse("Invalid action", cors);
  } catch (err) {
    return safeErrorResponse(err, "[superadmin-security-flags]", cors);
  }
});

