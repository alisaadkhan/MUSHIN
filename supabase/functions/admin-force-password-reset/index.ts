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
        const redirectTo =
          (Deno.env.get("SITE_URL") || Deno.env.get("APP_URL") || "").replace(/\/$/, "") + "/update-password";

        const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
            type: 'recovery',
            email: targetUser.user.email,
            options: redirectTo ? { redirectTo } : undefined,
        });

        if (linkError) throw linkError;

        // Preferred: let Supabase send the recovery email (if email provider configured).
        // Some projects reject this call when executed from service_role; if that happens we fall back to Resend.
        let dispatched = false;
        try {
            const { error: dispatchError } = await serviceClient.auth.resetPasswordForEmail(targetUser.user.email, {
                redirectTo: redirectTo || undefined,
            });
            if (dispatchError) throw dispatchError;
            dispatched = true;
        } catch (e) {
            console.warn("[admin-force-password-reset] resetPasswordForEmail failed; falling back to Resend:", e);
        }

        if (!dispatched) {
            const resendKey = Deno.env.get("RESEND_API_KEY");
            const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || Deno.env.get("FROM_EMAIL");
            const recoveryLink = (linkData as any)?.properties?.action_link as string | undefined;

            if (!resendKey || !fromEmail || !recoveryLink) {
                // Don't fail the admin action if we generated the link; return it for manual delivery.
                // This avoids "internal server error" toasts when SMTP isn't configured.
                return new Response(JSON.stringify({ success: true, dispatched: false, recovery_link: recoveryLink ?? null }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const resp = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${resendKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: fromEmail,
                    to: targetUser.user.email,
                    subject: "Reset your password",
                    html: `
                      <p>You requested a password reset.</p>
                      <p><a href="${recoveryLink}">Click here to reset your password</a></p>
                      <p>If you did not request this, you can ignore this email.</p>
                    `,
                }),
            });
            if (!resp.ok) {
                const txt = await resp.text().catch(() => "");
                throw new Error(`Resend failed (${resp.status}): ${txt}`);
            }
            dispatched = true;
        }

        await logAdminAction({
            actorUserId: userId,
            targetUserId: target_user_id,
            actionType: "admin:user:force_password_reset",
            actionDescription: "Admin forced password reset email dispatch",
            ipAddress,
            userAgent,
        });

        return new Response(JSON.stringify({ success: true, dispatched }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return safeErrorResponse(err, "[admin-force-password-reset]", corsHeaders);
    }
});
