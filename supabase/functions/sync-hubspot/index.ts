import { performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";
import { assertNoSecretsInRequestBody } from "../_shared/secrets.ts";
const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": APP_URL,
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
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const requestBody = await req.json();
    assertNoSecretsInRequestBody(requestBody, "sync-hubspot");
    const { contacts, workspace_id } = requestBody;

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

    // Read the HubSpot API key using the encrypted store (MED-04)
    const serviceClient = await performPrivilegedWrite({
        authHeader: req.headers.get("Authorization"),
        action: "gateway:privileged-client-bootstrap",
        execute: async (_ctx, client) => client,
    });

    const { data: keyData, error: keyErr } = await serviceClient
      .rpc("get_hubspot_key", { p_workspace_id: workspace_id });

    const hubspot_api_key = keyData as string | null;
    if (keyErr || !hubspot_api_key) {
      return new Response(JSON.stringify({ error: "HubSpot API key not configured" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const results = [];

    // Only sync contacts with real verified email addresses.
    // Creating HubSpot records with fake/proxy emails causes CRM data pollution
    // and risks HubSpot account suspension for TOS violation.
    const syncableContacts = contacts.filter(
      (c: any) => c.email && typeof c.email === "string" && c.email.includes("@") && !c.email.endsWith(".local") && !c.email.includes("proxy")
    );

    if (syncableContacts.length === 0) {
      return new Response(JSON.stringify({
        results: [],
        skipped: contacts.length,
        message: "No contacts had valid email addresses. Collect real emails before syncing to HubSpot.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    for (const contact of syncableContacts) {
      const hubspotPayload = {
        properties: {
          firstname: contact.username || "",
          lastname: contact.platform || "",
          // HubSpot rejects invalid domains. Use a dedicated dummy domain that passes validation.
          email: contact.email || null,
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
