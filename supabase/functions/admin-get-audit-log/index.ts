import { getAdminAuditLogs, requireJwt, requireSystemAdmin } from "../_shared/privileged_gateway.ts";
import { logAdminAction, logSystemAction } from "../_shared/audit_logger.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { checkRateLimit } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse(req, { error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 30, perHour: 240 });
    if (!rate.allowed) {
      await logSystemAction({
        actionType: "security:rate_limit",
        actionDescription: "Rate limit exceeded for admin-get-audit-log",
        ipAddress,
        userAgent,
      });
      return jsonResponse(req, { error: "Too many requests" }, 429);
    }

    if (!authHeader?.startsWith("Bearer ")) {
      await logSystemAction({
        actionType: "auth:login_attempt",
        actionDescription: "Admin audit-log blocked due to missing token",
        ipAddress,
        userAgent,
        metadata: { endpoint: "admin-get-audit-log", status: "failed" },
      });
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const { userId: actorUserId } = await requireJwt(authHeader);
    await requireSystemAdmin(authHeader);

    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const actor_user_id = url.searchParams.get("actor_user_id") ?? undefined;
    const workspace_id = url.searchParams.get("workspace_id") ?? undefined;
    const action_type = url.searchParams.get("action_type") ?? undefined;

    const result = await getAdminAuditLogs({
      authHeader,
      limit,
      actorUserId: actor_user_id,
      workspaceId: workspace_id,
      actionType: action_type,
    });

    await logAdminAction({
      actorUserId,
      actionType: "admin:audit_log:get",
      actionDescription: "System admin fetched audit logs",
      ipAddress,
      userAgent,
      metadata: { limit, actor_user_id, workspace_id, action_type },
    });

    return jsonResponse(req, result);
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      try {
        const { userId } = await requireJwt(authHeader);
        await logAdminAction({
          actorUserId: userId,
          actionType: "security:admin_access_denied",
          actionDescription: "Non-system-admin attempted admin-get-audit-log",
          ipAddress,
          userAgent,
        });
      } catch {
        // Ignore nested failures.
      }
      return jsonResponse(req, { error: "Forbidden" }, 403);
    }

    if (err instanceof Error && err.message === "Unauthorized") {
      await logSystemAction({
        actionType: "auth:login_attempt",
        actionDescription: "Admin audit-log blocked due to invalid token",
        ipAddress,
        userAgent,
        metadata: { endpoint: "admin-get-audit-log", status: "failed" },
      });
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    return safeErrorResponse(err, "[admin-get-audit-log]", corsHeaders);
  }
});
