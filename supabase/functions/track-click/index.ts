import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        // This is typically called via a GET request to a short url route like /api/t/{code}
        const url = new URL(req.url);
        const code = url.searchParams.get("code");

        if (!code) {
            return new Response("Missing tracking code", { status: 400 });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // 1. Find the link
        const { data: link, error: linkErr } = await serviceClient
            .from("tracking_links")
            .select("id, original_url, influencer_id")
            .eq("tracking_code", code)
            .single();

        if (linkErr || !link) {
            return new Response("Tracking link not found", { status: 404 });
        }

        // 2. Log the click natively using RPC to handle UPSERT cleanly
        // A production system might push this to a queue or edge KV for performance,
        // but we'll do direct PG for simplicity matching Modash's basic tier scope.
        const today = new Date().toISOString().split('T')[0];

        // Using an upsert directly via PostgREST
        const { error: upsertErr } = await serviceClient
            .from('campaign_metrics')
            .upsert({
                tracking_link_id: link.id,
                influencer_id: link.influencer_id,
                date: today,
                // We use simple raw SQL rpc if we wanted atomic increment, 
                // but for this MVP upsert definition we assume initial insert or handle via a DB trigger.
                // A more robust way without a trigger:
            }, { onConflict: 'tracking_link_id, date' })
            .select()
            .single();

        // To properly increment, we usually call an RPC. We'll simulate atomic increment here:
        if (!upsertErr) {
            await serviceClient.rpc('increment_click_metric', {
                link_id: link.id,
                metric_date: today,
                influencer_uuid: link.influencer_id
            });
        }

        // 3. Redirect — validate URL scheme to prevent open redirect to javascript: or data: URIs
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(link.original_url);
        } catch {
            return new Response("Invalid redirect target", { status: 400 });
        }
        if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
            return new Response("Invalid redirect target", { status: 400 });
        }
        return Response.redirect(link.original_url, 302);

    } catch (err: any) {
        console.error("Track Click Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
