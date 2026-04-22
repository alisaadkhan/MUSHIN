import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import {
  createPrivilegedClient,
  requireSystemAdmin,
  sanitizeUuid,
} from "../_shared/privileged_gateway.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";

function json(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_PLANS = ["free", "pro", "business", "enterprise"] as const;
type AllowedPlan = (typeof ALLOWED_PLANS)[number];

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(corsHeaders, { error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    await requireSystemAdmin(authHeader);

    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body.target_user_id ?? body.user_id ?? "").trim();
    const planRaw = String(body.plan ?? "").trim().toLowerCase();
    const plan = (ALLOWED_PLANS as readonly string[]).includes(planRaw) ? (planRaw as AllowedPlan) : null;

    if (!sanitizeUuid(targetUserId)) return validationErrorResponse("target_user_id required", corsHeaders);
    if (!plan) return validationErrorResponse(`plan must be one of: ${ALLOWED_PLANS.join(", ")}`, corsHeaders);

    const client = createPrivilegedClient();

    // Find the user's primary workspace (owner workspace)
    const { data: ws, error: wsErr } = await client
      .from("workspaces")
      .select("id, owner_id, plan")
      .eq("owner_id", targetUserId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (wsErr) throw wsErr;
    if (!ws?.id) return json(corsHeaders, { error: "Workspace not found for user" }, 404);

    // Update workspace plan immediately (drives most in-app gating)
    const { error: updErr } = await client
      .from("workspaces")
      .update({ plan })
      .eq("id", ws.id);
    if (updErr) throw updErr;

    // Keep subscriptions table consistent for admin dashboards and any code that reads it.
    // This is an admin override: it does NOT charge Stripe/Paddle. It applies immediately in-app.
    if (plan === "free") {
      // Deactivate any existing subscription row
      await client.from("subscriptions").update({ status: "canceled", plan }).eq("workspace_id", ws.id);
    } else {
      const now = new Date();
      const start = now.toISOString();
      const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: upErr } = await client.from("subscriptions").upsert(
        {
          workspace_id: ws.id,
          plan,
          status: "active",
          stripe_customer_id: "admin_override",
          stripe_subscription_id: null,
          current_period_start: start,
          current_period_end: end,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "workspace_id" },
      );
      if (upErr) throw upErr;
    }

    return json(corsHeaders, { success: true, workspace_id: ws.id, plan });
  } catch (err) {
    return safeErrorResponse(err, "[admin-set-user-plan]", corsHeaders);
  }
});

