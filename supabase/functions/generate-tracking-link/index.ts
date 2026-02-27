import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple pseudo-random string generator for tracking codes
const generateTrackingCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

        const token = authHeader.replace("Bearer ", "");
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) throw new Error("Unauthorized");

        const { campaign_id, influencer_id, original_url } = await req.json();
        if (!campaign_id || !influencer_id || !original_url) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Verify user has access to this campaign
        const { data: campaign, error: campaignErr } = await supabase
            .from("campaigns")
            .select("id")
            .eq("id", campaign_id)
            .single();

        if (campaignErr || !campaign) {
            return new Response(JSON.stringify({ error: "Campaign not found or access denied" }), { status: 403, headers: corsHeaders });
        }

        const trackingCode = generateTrackingCode();
        // In production, you would map this to a custom domain (e.g., trk.influenceiq.com/{code})
        const shortUrl = `${req.headers.get("origin") || "https://app.influenceiq.com"}/api/t/${trackingCode}`;

        const { data: trackingLink, error: insertErr } = await serviceClient
            .from("tracking_links")
            .insert({
                campaign_id,
                influencer_id,
                original_url,
                tracking_code: trackingCode,
                short_url: shortUrl
            })
            .select()
            .single();

        if (insertErr) throw insertErr;

        return new Response(JSON.stringify({ success: true, tracking_link: trackingLink }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("Generate Link Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
