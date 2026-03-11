import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const corsHeaders = {
    "Access-Control-Allow-Origin": APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Campaign metrics aggregation function.
// Reads from campaign_metrics table (populated by track-click via tracking links).
// Does NOT generate mock data — only returns real tracked click data.
// If no real data exists, returns empty metrics with a clear data_available: false flag.

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const token = authHeader.replace("Bearer ", "");
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const url = new URL(req.url);
        const campaign_id = url.searchParams.get("campaign_id");
        const days = Math.min(parseInt(url.searchParams.get("days") || "30", 10), 90);

        if (!campaign_id) {
            return new Response(JSON.stringify({ error: "campaign_id required" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Verify user has access to this campaign via RLS
        const { data: campaign, error: campaignErr } = await supabase
            .from("campaigns")
            .select("id, name, workspace_id, status")
            .eq("id", campaign_id)
            .single();

        if (campaignErr || !campaign) {
            return new Response(JSON.stringify({ error: "Campaign not found or access denied" }), {
                status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Fetch real metric data for this campaign's tracking links
        const since = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

        const { data: metrics, error: metricsErr } = await serviceClient
            .from("campaign_metrics")
            .select(`
                date, clicks, conversions, revenue_generated,
                tracking_links!inner(campaign_id, influencer_id)
            `)
            .eq("tracking_links.campaign_id", campaign_id)
            .gte("date", since)
            .order("date", { ascending: true });

        if (metricsErr) throw metricsErr;

        // Aggregate real metrics
        const totalClicks = (metrics || []).reduce((s, m) => s + (m.clicks || 0), 0);
        const totalConversions = (metrics || []).reduce((s, m) => s + (m.conversions || 0), 0);
        const totalRevenue = (metrics || []).reduce((s, m) => s + parseFloat(m.revenue_generated || "0"), 0);

        // Daily series for charting
        const dailySeries = (metrics || []).reduce((acc: Record<string, any>, m) => {
            if (!acc[m.date]) acc[m.date] = { date: m.date, clicks: 0, conversions: 0, revenue: 0 };
            acc[m.date].clicks += m.clicks || 0;
            acc[m.date].conversions += m.conversions || 0;
            acc[m.date].revenue += parseFloat(m.revenue_generated || "0");
            return acc;
        }, {});

        const data_available = totalClicks > 0;

        return new Response(JSON.stringify({
            campaign_id,
            campaign_name: campaign.name,
            period_days: days,
            data_available,
            data_source: "tracking_links",
            warning: !data_available
                ? "No tracking data yet. Share campaign tracking links to start recording real clicks."
                : null,
            summary: {
                total_clicks: totalClicks,
                total_conversions: totalConversions,
                total_revenue_usd: parseFloat(totalRevenue.toFixed(2)),
                conversion_rate: totalClicks > 0 ? parseFloat(((totalConversions / totalClicks) * 100).toFixed(2)) : 0,
                avg_order_value: totalConversions > 0 ? parseFloat((totalRevenue / totalConversions).toFixed(2)) : 0,
                roi_note: "Revenue figures are from tracked link clicks only. Untracked channels are not included."
            },
            daily_series: Object.values(dailySeries),
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err: any) {
        return safeErrorResponse(err, "[fetch-campaign-metrics]", corsHeaders);
    }
});
