import { createPrivilegedClient, requireJwt, requireSystemAdmin, sanitizeUuid } from "../_shared/privileged_gateway.ts";
import { logAdminAction, logSystemAction } from "../_shared/audit_logger.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { checkRateLimit, corsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 20, perHour: 160 });
    if (!rate.allowed) {
      await logSystemAction({
        actionType: "security:rate_limit",
        actionDescription: "Rate limit exceeded for admin-get-user",
        ipAddress,
        userAgent,
      });
      return jsonResponse({ error: "Too many requests" }, 429);
    }

    if (!authHeader?.startsWith("Bearer ")) {
      await logSystemAction({
        actionType: "auth:login_attempt",
        actionDescription: "Admin get-user blocked due to missing token",
        ipAddress,
        userAgent,
        metadata: { endpoint: "admin-get-user", status: "failed" },
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { userId: actorUserId } = await requireJwt(authHeader);
    await requireSystemAdmin(authHeader);

    const url = new URL(req.url);
    const userIdParam = url.searchParams.get("user_id");
    const emailParam = url.searchParams.get("email");

    if (!userIdParam && !emailParam) {
      return validationErrorResponse("Provide either user_id or email", corsHeaders);
    }

    const client = createPrivilegedClient();
    let query = client.from("admin_user_activity_view").select("*").limit(1);

    if (userIdParam) {
      if (!sanitizeUuid(userIdParam)) {
        return validationErrorResponse("user_id must be a valid UUID", corsHeaders);
      }
      query = query.eq("user_id", userIdParam);
    }

    if (emailParam) {
      query = query.ilike("email", emailParam);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return jsonResponse({ error: "User not found" }, 404);

    const { data: recentAudit, error: auditError } = await client
      .from("system_audit_logs")
      .select("id, timestamp, actor_user_id, target_user_id, workspace_id, action_type, action_description, metadata_json")
      .or(`actor_user_id.eq.${data.user_id},target_user_id.eq.${data.user_id}`)
      .order("timestamp", { ascending: false })
      .limit(100);
    if (auditError) throw auditError;

    await logAdminAction({
      actorUserId,
      targetUserId: data.user_id,
      actionType: "admin:user:get",
      actionDescription: "System admin fetched user activity profile",
      ipAddress,
      userAgent,
      metadata: { lookup_by_user_id: userIdParam ?? null, lookup_by_email: emailParam ?? null },
    });

    return jsonResponse({ success: true, user: data, recent_audit_logs: recentAudit ?? [] });
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      try {
        const { userId } = await requireJwt(authHeader);
        await logAdminAction({
          actorUserId: userId,
          actionType: "security:admin_access_denied",
          actionDescription: "Non-system-admin attempted admin-get-user",
          ipAddress,
          userAgent,
        });
      } catch {
        // Ignore nested failures.
      }
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    if (err instanceof Error && err.message === "Unauthorized") {
      await logSystemAction({
        actionType: "auth:login_attempt",
        actionDescription: "Admin get-user blocked due to invalid token",
        ipAddress,
        userAgent,
        metadata: { endpoint: "admin-get-user", status: "failed" },
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    return safeErrorResponse(err, "[admin-get-user]", corsHeaders);
  }
});
