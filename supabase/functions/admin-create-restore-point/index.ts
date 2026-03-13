import { createRestorePoint, listRestorePoints, requireJwt, requireSystemAdmin } from "../_shared/privileged_gateway.ts";
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

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 8, perHour: 80 });
    if (!rate.allowed) {
      await logSystemAction({
        actionType: "security:rate_limit",
        actionDescription: "Rate limit exceeded for admin-create-restore-point",
        ipAddress,
        userAgent,
      });
      return jsonResponse({ error: "Too many requests" }, 429);
    }

    if (!authHeader?.startsWith("Bearer ")) {
      await logSystemAction({
        actionType: "auth:login_attempt",
        actionDescription: "Restore-point endpoint blocked due to missing token",
        ipAddress,
        userAgent,
        metadata: { endpoint: "admin-create-restore-point", status: "failed" },
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { userId: actorUserId } = await requireJwt(authHeader);
    await requireSystemAdmin(authHeader);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const limit = Number(url.searchParams.get("limit") ?? 50);
      const result = await listRestorePoints({ authHeader, limit });

      await logAdminAction({
        actorUserId,
        actionType: "admin:restore_point:list",
        actionDescription: "System admin listed restore points",
        ipAddress,
        userAgent,
        metadata: { limit },
      });

      return jsonResponse(result);
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const { description, metadata } = await req.json();
    if (!description || String(description).trim().length < 8) {
      return validationErrorResponse("description is required and must be at least 8 chars", corsHeaders);
    }

    const result = await createRestorePoint({
      authHeader,
      description: String(description).trim(),
      metadata: metadata ?? {},
      ipAddress,
      userAgent,
    });

    await logAdminAction({
      actorUserId,
      actionType: "admin:restore_point:create:api",
      actionDescription: "Admin restore-point create request completed",
      ipAddress,
      userAgent,
      metadata: { description },
    });

    return jsonResponse(result);
  } catch (err) {
    if (err instanceof Error && err.message === "Forbidden") {
      try {
        const { userId } = await requireJwt(authHeader);
        await logAdminAction({
          actorUserId: userId,
          actionType: "security:admin_access_denied",
          actionDescription: "Non-system-admin attempted admin-create-restore-point",
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
        actionDescription: "Restore-point endpoint blocked due to invalid token",
        ipAddress,
        userAgent,
        metadata: { endpoint: "admin-create-restore-point", status: "failed" },
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    return safeErrorResponse(err, "[admin-create-restore-point]", corsHeaders);
  }
});
