import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";
import { checkRateLimit } from "../_shared/rate_limit.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const corsHeaders = {
    "Access-Control-Allow-Origin": APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Validates that the URL has a safe scheme (http/https only). */
function isValidTrackingUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

// Cryptographically secure tracking code — collision-resistant up to 10M+ codes
function generateTrackingCode(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(36).padStart(2, "0"))
        .join("")
        .toUpperCase()
        .substring(0, 10);
}

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

        // Rate limit: 60 requests/min, 300/hr per IP (prevent link-spam abuse)
        const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        const rl = await checkRateLimit(ipAddress, "general");
        if (!rl.allowed) {
            return new Response(
                JSON.stringify({ error: "Too many requests. Please slow down.", retryAfter: rl.retryAfter }),
                { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter ?? 60) } }
            );
        }

        const { campaign_id, influencer_id, original_url } = await req.json();
        if (!campaign_id || !influencer_id || !original_url) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // SEC: reject non-http(s) URLs to prevent javascript:/data: stored XSS via tracking links
        if (!isValidTrackingUrl(original_url)) {
            return new Response(
                JSON.stringify({ error: "original_url must use http or https scheme" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

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
        // In production, you would map this to a custom domain (e.g., trk.mushin.com/{code})
        const shortUrl = `${req.headers.get("origin") || "https://app.mushin.com"}/api/t/${trackingCode}`;

        // RLS already scopes tracking_links writes to workspace members.
        const { data: trackingLink, error: insertErr } = await supabase
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
        return safeErrorResponse(err, "[generate-tracking-link]", corsHeaders);
    }
});
