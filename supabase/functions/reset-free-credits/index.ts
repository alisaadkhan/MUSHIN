import { getServiceRoleKey } from "../_shared/privileged_gateway.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";
const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": APP_URL,
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
    const serviceKey = getServiceRoleKey();
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
        search_credits_remaining: 30,
        enrichment_credits_remaining: 3,
        email_sends_remaining: 10,
        ai_credits_remaining: 3,
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
    return safeErrorResponse(err, "[reset-free-credits]", corsHeaders);
  }
});
