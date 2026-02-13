import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub as string;

    // Use service role for cascading deletions
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get workspace
    const { data: membership } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .single();

    if (membership?.workspace_id) {
      const wid = membership.workspace_id;

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
      await supabaseAdmin.from("workspace_members").delete().eq("workspace_id", wid);
      await supabaseAdmin.from("workspaces").delete().eq("id", wid);
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
