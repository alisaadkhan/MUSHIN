import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClientWithAuth, requireJwt, createPrivilegedClient } from "../_shared/privileged_gateway.ts";
import { logUserAction } from "../_shared/audit_logger.ts";
import { extractClientIp } from "../_shared/security.ts";

function getAppUrl(): string {
  return (Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "https://mushin.app").replace(/\/$/, "");
}

type Body = {
  target_user_id?: string;
  reason?: string;
};

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const { userId: supportUserId } = await requireJwt(authHeader);
    const body = (await req.json().catch(() => ({}))) as Body;

    const targetUserId = body.target_user_id ?? "";
    const reason = String(body.reason ?? "").trim().slice(0, 400);

    if (!targetUserId) return validationErrorResponse("target_user_id required", corsHeaders);
    if (!reason) return validationErrorResponse("reason required", corsHeaders);

    // Permission check via RPC that reads from support_staff_rbac (and admin overrides).
    const authedPrivClient = createPrivilegedClientWithAuth(authHeader ?? "");
    const { data: perms, error: permErr } = await authedPrivClient.rpc("get_my_support_permissions");
    if (permErr) throw permErr;

    const canImpersonate = Boolean((perms as any)?.canImpersonate);
    if (!canImpersonate) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createPrivilegedClient();
    const { data: target, error: getUserError } = await serviceClient.auth.admin.getUserById(targetUserId);
    if (getUserError || !target?.user?.email) {
      return new Response(JSON.stringify({ error: "Target user not found or has no email" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a magic link. WARNING: following it will change the session in the same browser profile.
    // Use a separate browser profile/incognito to avoid losing the support session.
    const redirectTo = `${getAppUrl()}/dashboard?impersonated=1`;

    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email: target.user.email,
      options: { redirectTo },
    });
    if (linkError) throw linkError;

    const actionLink = (linkData as any)?.properties?.action_link as string | undefined;
    if (!actionLink) throw new Error("Failed to generate impersonation link");

    // Best-effort: log support action + system audit trail
    try {
      await authedPrivClient.from("support_actions_log").insert({
        support_id: supportUserId,
        action: "impersonate_user",
        target_user_id: targetUserId,
        metadata: { reason, redirectTo },
      });
    } catch {
      // ignore
    }

    await logUserAction({
      actorUserId: supportUserId,
      targetUserId,
      actionType: "support:impersonate",
      actionDescription: "Support staff generated user impersonation link (magiclink)",
      ipAddress,
      userAgent,
      metadata: { reason, redirect_to: redirectTo },
    });

    return new Response(JSON.stringify({ success: true, action_link: actionLink, redirect_to: redirectTo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return safeErrorResponse(err, "[support-impersonate-user]", corsHeaders);
  }
});

