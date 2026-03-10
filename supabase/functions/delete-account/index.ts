import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { checkRateLimit } from "../_shared/rate_limit.ts";

const ALLOWED_ORIGIN = Deno.env.get("APP_URL") || "https://mushin.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit: max 3 account-deletion attempts per hour per IP
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(clientIp, 'general', { perMin: 3, perHour: 3 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter ?? 3600) },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;

    // Use service role for cascading deletions
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as const }) : null;

    // Get workspace membership
    const { data: membership } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .single();

    if (membership?.workspace_id) {
      const wid = membership.workspace_id;

      // SEC-07: Only the workspace owner may delete the entire workspace.
      // Members who are not the owner only have their own membership removed.
      const { data: workspace } = await supabaseAdmin
        .from("workspaces")
        .select("owner_id")
        .eq("id", wid)
        .single();

      const isOwner = workspace?.owner_id === userId;

      if (isOwner) {
        // SEC-08: Cancel Stripe subscription before deleting DB record
        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("stripe_subscription_id")
          .eq("workspace_id", wid)
          .maybeSingle();

        if (sub?.stripe_subscription_id && stripe) {
          try {
            await stripe.subscriptions.cancel(sub.stripe_subscription_id);
          } catch (stripeErr: any) {
            console.error("[delete-account] Stripe cancellation failed:", stripeErr.message);
            // Continue — partial failure is better than leaving the user unable to delete their account
          }
        }

      // Get campaign IDs
        const { data: campaigns } = await supabaseAdmin
          .from("campaigns")
          .select("id")
          .eq("workspace_id", wid);
        const campaignIds = campaigns?.map((c) => c.id) || [];

        if (campaignIds.length > 0) {
          // Delete outreach logs, pipeline cards, stages, activity
          await supabaseAdmin.from("outreach_log").delete().in("campaign_id", campaignIds);
          await supabaseAdmin.from("pipeline_cards").delete().in("campaign_id", campaignIds);
          await supabaseAdmin.from("pipeline_stages").delete().in("campaign_id", campaignIds);
          await supabaseAdmin.from("campaign_activity").delete().in("campaign_id", campaignIds);
          await supabaseAdmin.from("campaigns").delete().in("id", campaignIds);
        }

        // Delete lists and items
        const { data: lists } = await supabaseAdmin
          .from("influencer_lists")
          .select("id")
          .eq("workspace_id", wid);
        const listIds = lists?.map((l) => l.id) || [];
        if (listIds.length > 0) {
          await supabaseAdmin.from("list_items").delete().in("list_id", listIds);
          await supabaseAdmin.from("influencer_lists").delete().in("id", listIds);
        }

        // Delete workspace-level data
        await supabaseAdmin.from("credits_usage").delete().eq("workspace_id", wid);
        await supabaseAdmin.from("email_templates").delete().eq("workspace_id", wid);
        await supabaseAdmin.from("saved_searches").delete().eq("workspace_id", wid);
        await supabaseAdmin.from("search_history").delete().eq("workspace_id", wid);
        await supabaseAdmin.from("subscriptions").delete().eq("workspace_id", wid);
        await supabaseAdmin.from("enrichment_jobs").delete().eq("workspace_id", wid);
        await supabaseAdmin.from("anomaly_logs").delete().eq("workspace_id", wid);
        await supabaseAdmin.from("notification_log").delete().eq("workspace_id", wid).catch(() => null);
        await supabaseAdmin.from("workspace_members").delete().eq("workspace_id", wid);
        await supabaseAdmin.from("workspaces").delete().eq("id", wid);
      } else {
        // Non-owner: only remove this user's membership, leave the workspace intact
        await supabaseAdmin
          .from("workspace_members")
          .delete()
          .eq("workspace_id", wid)
          .eq("user_id", userId);
      }
    }

    // Delete user profile and roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // Delete auth user
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
