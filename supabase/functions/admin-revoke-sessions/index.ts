import { requireJwt, requireSystemAdmin, createPrivilegedClient } from "../_shared/privileged_gateway.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { extractClientIp } from "../_shared/security.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const { userId } = await requireJwt(authHeader);
    await requireSystemAdmin(authHeader);

    const body = await req.json().catch(() => ({}));
    const targetUserId = body?.target_user_id as string | undefined;
    if (!targetUserId) {
      return validationErrorResponse("target_user_id required", corsHeaders);
    }

    const client = createPrivilegedClient();
    // Supabase Admin API: invalidate refresh tokens, forcing all sessions to re-auth
    const { error } = await client.auth.admin.invalidateUserRefreshTokens(targetUserId);
    if (error) throw error;

    await logAdminAction({
      actorUserId: userId,
      targetUserId,
      actionType: "admin:sessions:revoke",
      actionDescription: "Admin revoked all user sessions (refresh tokens invalidated)",
      ipAddress,
      userAgent,
      metadata: { endpoint: "admin-revoke-sessions" },
    });

    return jsonResponse({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }
    if (err instanceof Error && err.message === "Unauthorized") {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    return safeErrorResponse(err, "[admin-revoke-sessions]", corsHeaders);
  }
});

