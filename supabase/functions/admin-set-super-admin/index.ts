import { createPrivilegedClient, isSuperAdmin, requireJwt, sanitizeUuid } from "../_shared/privileged_gateway.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { corsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const { userId: actorUserId } = await requireJwt(authHeader);
    const callerSuperAdmin = await isSuperAdmin(actorUserId);
    if (!callerSuperAdmin) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const targetUserId = sanitizeUuid(body?.target_user_id);
    const enable = Boolean(body?.enable);
    const reason = String(body?.reason ?? "role governance update");

    if (!targetUserId) {
      return validationErrorResponse("target_user_id is required and must be a valid UUID", corsHeaders);
    }

    const client = createPrivilegedClient();
    const { data, error } = await client.rpc("set_super_admin_role", {
      p_actor_user_id: actorUserId,
      p_target_user_id: targetUserId,
      p_enable: enable,
      p_reason: reason,
    });

    if (error) throw error;

    const { error: logError } = await client.rpc("append_system_audit_log", {
      p_actor_user_id: actorUserId,
      p_target_user_id: targetUserId,
      p_workspace_id: null,
      p_action_type: enable ? "admin:super_admin:grant:api" : "admin:super_admin:revoke:api",
      p_action_description: "Super admin authority changed by super admin endpoint",
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_metadata_json: {
        enable,
        reason,
      },
    });
    if (logError) throw logError;

    return jsonResponse({ success: true, result: data });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    return safeErrorResponse(err, "[admin-set-super-admin]", corsHeaders);
  }
});
