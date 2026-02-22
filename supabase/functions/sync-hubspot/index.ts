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

    // Validate user auth
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { contacts, workspace_id } = await req.json();

    if (!workspace_id || !contacts?.length) {
      return new Response(JSON.stringify({ error: "Missing workspace_id or contacts" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Verify user is a member of the workspace
    const { data: memberCheck } = await userClient.rpc("is_workspace_member", { _workspace_id: workspace_id });
    if (!memberCheck) {
      return new Response(JSON.stringify({ error: "Not a workspace member" }), { status: 403, headers: corsHeaders });
    }

    // Read the HubSpot API key server-side using service role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: secretsData } = await serviceClient
      .from("workspace_secrets")
      .select("hubspot_api_key")
      .eq("workspace_id", workspace_id)
      .single();

    const hubspot_api_key = secretsData?.hubspot_api_key;
    if (!hubspot_api_key) {
      return new Response(JSON.stringify({ error: "HubSpot API key not configured" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const results = [];

    for (const contact of contacts) {
      const hubspotPayload = {
        properties: {
          firstname: contact.username || "",
          lastname: contact.platform || "",
          email: contact.email || `${contact.username}@placeholder.local`,
          jobtitle: `${contact.platform} influencer`,
          company: contact.campaign_name || "",
          hs_lead_status: "CONNECTED",
        },
      };

      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hubspot_api_key}`,
        },
        body: JSON.stringify(hubspotPayload),
      });

      const data = await res.json();
      results.push({ username: contact.username, status: res.status, id: data?.id });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
