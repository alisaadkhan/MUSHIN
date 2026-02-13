import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const eventType = payload?.type;
    const emailTo = payload?.data?.to?.[0] || payload?.data?.email;

    if (!eventType || !emailTo) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the most recent outreach_log entry matching this email
    const { data: logEntry } = await adminClient
      .from("outreach_log")
      .select("id")
      .eq("email_to", emailTo)
      .order("contacted_at", { ascending: false })
      .limit(1)
      .single();

    if (!logEntry) {
      console.log("No outreach_log entry found for:", emailTo);
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    if (eventType === "email.opened") {
      await adminClient
        .from("outreach_log")
        .update({ opened_at: now })
        .eq("id", logEntry.id)
        .is("opened_at", null);
    } else if (eventType === "email.clicked") {
      await adminClient
        .from("outreach_log")
        .update({ clicked_at: now })
        .eq("id", logEntry.id)
        .is("clicked_at", null);
    }

    return new Response(JSON.stringify({ ok: true, matched: true, event: eventType }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("email-webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
