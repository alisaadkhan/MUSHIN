import { adminAdjustCredits, isSuperAdmin, requireJwt, requireSystemAdmin } from "../_shared/privileged_gateway.ts";
import { logAdminAction, logSystemAction } from "../_shared/audit_logger.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { checkRateLimit } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string>) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...headers, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req) => {
    const corsHeaders = buildCorsHeaders(req);
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }
    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
    }

    const authHeader = req.headers.get("Authorization");
    const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    try {
        if (!authHeader?.startsWith("Bearer ")) {
            await logSystemAction({
                actionType: "auth:login_attempt",
                actionDescription: "Admin credit adjustment blocked due to missing token",
                ipAddress,
                userAgent,
                metadata: { endpoint: "admin-adjust-credits", status: "failed" },
            });
            return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
        }

        const { userId } = await requireJwt(authHeader);
        const callerIsSuperAdmin = await isSuperAdmin(userId);
        if (!callerIsSuperAdmin) {
            const rate = await checkRateLimit(ipAddress, "general", { perMin: 12, perHour: 120 });
            if (!rate.allowed) {
                await logSystemAction({
                    actionType: "security:rate_limit",
                    actionDescription: "Rate limit exceeded for admin-adjust-credits",
                    ipAddress,
                    userAgent,
                    metadata: { retry_after: rate.retryAfter },
                });
                return jsonResponse({ error: "Too many requests" }, 429, corsHeaders);
            }
        }

        await requireSystemAdmin(authHeader);

        const { workspace_id, credit_type, amount_delta, mode, new_balance, reason, target_user_id, idempotency_key } = await req.json();
        if (!workspace_id || !credit_type || !reason || !target_user_id) {
            return validationErrorResponse(
                "workspace_id, target_user_id, credit_type, and reason are required",
                corsHeaders,
            );
        }

        const effectiveMode = mode === "set" ? "set" : "adjust";
        if (effectiveMode === "adjust" && amount_delta == null) {
            return validationErrorResponse("amount_delta is required for adjust mode", corsHeaders);
        }
        if (effectiveMode === "set" && new_balance == null) {
            return validationErrorResponse("new_balance is required for set mode", corsHeaders);
        }

        const result = await adminAdjustCredits({
            authHeader,
            workspaceId: workspace_id,
            creditType: credit_type,
            mode: effectiveMode,
            amountDelta: amount_delta == null ? undefined : Number(amount_delta),
            newBalance: new_balance == null ? undefined : Number(new_balance),
            reason,
            idempotencyKey: idempotency_key ?? undefined,
            targetUserId: target_user_id,
            ipAddress,
            userAgent,
        });

        await logAdminAction({
            actorUserId: userId,
            targetUserId: target_user_id ?? null,
            workspaceId: workspace_id,
            actionType: "admin:credits:adjust:api",
            actionDescription: "Admin credits adjustment request completed",
            ipAddress,
            userAgent,
            metadata: { credit_type, amount_delta, new_balance, mode: effectiveMode, reason, idempotency_key },
        });

        return jsonResponse(result, 200, corsHeaders);
    } catch (err) {
        if (err instanceof Error && err.message === "Forbidden") {
            try {
                const { userId } = await requireJwt(authHeader);
                await logAdminAction({
                    actorUserId: userId,
                    actionType: "security:admin_access_denied",
                    actionDescription: "Non-system-admin attempted admin-adjust-credits",
                    ipAddress,
                    userAgent,
                });
            } catch {
                // Ignore nested auth/logging failures.
            }
            return jsonResponse({ error: "Forbidden" }, 403, corsHeaders);
        }

        if (err instanceof Error && err.message === "Unauthorized") {
            await logSystemAction({
                actionType: "auth:login_attempt",
                actionDescription: "Admin credit adjustment blocked due to invalid token",
                ipAddress,
                userAgent,
                metadata: { endpoint: "admin-adjust-credits", status: "failed" },
            });
            return jsonResponse({ error: "Unauthorized" }, 401);
        }

        return safeErrorResponse(err, "[admin-adjust-credits]", corsHeaders);
    }
});
