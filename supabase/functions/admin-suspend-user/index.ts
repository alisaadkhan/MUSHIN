import { createPrivilegedClient, requireJwt, requireSystemAdmin } from "../_shared/privileged_gateway.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";
import { extractClientIp } from "../_shared/security.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
    const corsHeaders = buildCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const authHeader = req.headers.get("Authorization");
    const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    try {
        const { userId } = await requireJwt(authHeader);
        await requireSystemAdmin(authHeader);

        const { target_user_id, suspend } = await req.json().catch(() => ({}));
        if (!target_user_id) return validationErrorResponse("target_user_id required", corsHeaders);

        const serviceClient = createPrivilegedClient();
        if (suspend) {
            // Ban user for 100 years
            const { error } = await serviceClient.auth.admin.updateUserById(target_user_id, {
                ban_duration: "876000h",
            });
            if (error) throw error;
        } else {
            // Unban
            const { error } = await serviceClient.auth.admin.updateUserById(target_user_id, {
                ban_duration: "none",
            });
            if (error) throw error;
        }

        await logAdminAction({
            actorUserId: userId,
            targetUserId: target_user_id,
            actionType: suspend ? "admin:user:suspend" : "admin:user:unsuspend",
            actionDescription: suspend ? "User suspended via admin control plane" : "User unsuspended via admin control plane",
            ipAddress,
            userAgent,
            metadata: { suspend },
        });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return safeErrorResponse(err, "[admin-suspend-user]", corsHeaders);
    }
});
