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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { contacts, hubspot_api_key } = await req.json();

    if (!hubspot_api_key || !contacts?.length) {
      return new Response(JSON.stringify({ error: "Missing hubspot_api_key or contacts" }), {
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
