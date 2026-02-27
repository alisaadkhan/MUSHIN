import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        // This endpoint should ideally be triggered by a CRON (e.g. Supabase pg_cron)
        // We check for a secure service key or a specific cron-secret
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ") && req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // 1. Get all active tracking links that need metric updates for yesterday
        // In a real system, you'd integrate with Shopify API, WooCommerce, or Google Analytics 
        // to map traffic via the UTMs / tracking codes here.
        const { data: links, error: fetchErr } = await serviceClient
            .from("tracking_links")
            .select("id, tracking_code, influencer_id");

        if (fetchErr || !links) throw fetchErr;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        // Simulate fetching from an external provider (like a Shopify GraphQL query)
        const metricsToUpsert = links.map(link => {
            // Mock algorithm for daily stats (e.g. an influencer got 150 clicks, 3 sales on average)
            const mockClicks = Math.floor(Math.random() * 200);
            const mockConversions = Math.floor(mockClicks * 0.02); // 2% CVR
            const mockRevenue = mockConversions * 45.99; // $45.99 AOV

            return {
                tracking_link_id: link.id,
                influencer_id: link.influencer_id,
                date: dateStr,
                clicks: mockClicks,
                conversions: mockConversions,
                revenue_generated: mockRevenue
            };
        });

        if (metricsToUpsert.length > 0) {
            const { error: upsertErr } = await serviceClient
                .from("campaign_metrics")
                .upsert(metricsToUpsert, { onConflict: "tracking_link_id, date" });

            if (upsertErr) throw upsertErr;
        }

        return new Response(JSON.stringify({ success: true, processed: metricsToUpsert.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("Fetch Metrics Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
