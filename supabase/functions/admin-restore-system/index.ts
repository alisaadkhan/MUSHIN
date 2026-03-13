import { requireJwt, requireSystemAdmin, restoreFromSnapshot } from "../_shared/privileged_gateway.ts";
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
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 4, perHour: 40 });
    if (!rate.allowed) {
      await logSystemAction({
        actionType: "security:rate_limit",
        actionDescription: "Rate limit exceeded for admin-restore-system",
        ipAddress,
        userAgent,
      });
      return jsonResponse({ error: "Too many requests" }, 429);
    }

    if (!authHeader?.startsWith("Bearer ")) {
      await logSystemAction({
        actionType: "auth:login_attempt",
        actionDescription: "System restore blocked due to missing token",
        ipAddress,
        userAgent,
        metadata: { endpoint: "admin-restore-system", status: "failed" },
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { userId: actorUserId } = await requireJwt(authHeader);
    await requireSystemAdmin(authHeader);

    const { restore_point_id, reason, confirmation_token, action } = await req.json();
    if (!restore_point_id) {
      return validationErrorResponse("restore_point_id is required", corsHeaders);
    }

    if (action === "request_confirmation") {
      const result = await restoreFromSnapshot({
        authHeader,
        restorePointId: restore_point_id,
        reason: reason ?? "request_confirmation",
        requestConfirmationOnly: true,
        ipAddress,
        userAgent,
      });

      await logAdminAction({
        actorUserId,
        actionType: "admin:restore:confirmation_requested:api",
        actionDescription: "Admin requested restore confirmation token",
        ipAddress,
        userAgent,
        metadata: { restore_point_id },
      });

      return jsonResponse(result);
    }

    if (!reason || String(reason).trim().length < 10) {
      return validationErrorResponse("reason is required and must be at least 10 chars", corsHeaders);
    }

    if (!confirmation_token) {
      return validationErrorResponse("confirmation_token is required", corsHeaders);
    }

    const isDryRun = action !== "execute";
    const result = await restoreFromSnapshot({
      authHeader,
      restorePointId: restore_point_id,
      reason,
      confirmationToken: confirmation_token,
      dryRun: isDryRun,
      ipAddress,
      userAgent,
    });

    await logAdminAction({
      actorUserId,
      actionType: isDryRun ? "admin:restore:dry_run:api" : "admin:restore:execute:api",
      actionDescription: isDryRun
        ? "Admin ran restore dry-run"
        : "Admin executed system restore",
      ipAddress,
      userAgent,
      metadata: { restore_point_id, reason },
    });

    return jsonResponse(result);
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      try {
        const { userId } = await requireJwt(authHeader);
        await logAdminAction({
          actorUserId: userId,
          actionType: "security:admin_access_denied",
          actionDescription: "Non-system-admin attempted admin-restore-system",
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
        actionDescription: "System restore blocked due to invalid token",
        ipAddress,
        userAgent,
        metadata: { endpoint: "admin-restore-system", status: "failed" },
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    return safeErrorResponse(err, "[admin-restore-system]", corsHeaders);
  }
});
