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

        const { target_user_id } = await req.json().catch(() => ({}));
        if (!target_user_id) return validationErrorResponse("target_user_id required", corsHeaders);

        const serviceClient = createPrivilegedClient();

        // Get target user email
        const { data: targetUser, error: getUserError } = await serviceClient.auth.admin.getUserById(target_user_id);
        
        if (getUserError || !targetUser?.user?.email) {
            throw getUserError || new Error("Target user not found or has no email");
        }

        // Send reset email via Admin API
        const { error: resetError } = await serviceClient.auth.admin.generateLink({
            type: 'recovery',
            email: targetUser.user.email
        });
        
        // Wait, generateLink only returns the link. To actually dispatch the Supabase template email, we should use resetPasswordForEmail without the admin wrapper.
        const { error: dispatchError } = await serviceClient.auth.resetPasswordForEmail(targetUser.user.email);
        
        if (dispatchError) {
            throw dispatchError;
        }

        await logAdminAction({
            actorUserId: userId,
            targetUserId: target_user_id,
            actionType: "admin:user:force_password_reset",
            actionDescription: "Admin forced password reset email dispatch",
            ipAddress,
            userAgent,
        });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return safeErrorResponse(err, "[admin-force-password-reset]", corsHeaders);
    }
});
