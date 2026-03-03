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

  try {
    // Validate authorization (anon key from cron or service role)
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Only callable by cron jobs or internal services using the service role key
    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized — internal endpoint" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
      .from("workspaces")
      .update({
        search_credits_remaining: 3,
        enrichment_credits_remaining: 2,
        email_sends_remaining: 5,
        ai_credits_remaining: 0,
        credits_reset_at: new Date().toISOString(),
      })
      .eq("plan", "free")
      .select("id");

    if (error) throw error;

    const count = data?.length ?? 0;
    console.log(`[RESET-FREE-CREDITS] Reset ${count} free workspaces`);

    return new Response(
      JSON.stringify({ success: true, workspaces_reset: count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[RESET-FREE-CREDITS] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
