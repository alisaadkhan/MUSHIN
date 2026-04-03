import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPrivilegedClient } from "../_shared/privileged_gateway.ts";
import { checkRateLimit } from "../_shared/rate_limit.ts";
/** Prevent XSS by escaping all HTML special characters before injecting into templates. */
function escHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";

// HIGH-01 FIX: Restrict CORS to app domain only — NOT wildcard.
// This endpoint is public (SEO/SSR), but cross-origin reads should be controlled.
const corsHeaders = {
    "Access-Control-Allow-Origin": APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_PLATFORMS = ["instagram", "youtube", "tiktok"];

// Extremely basic SSR generation for SEO purposes
// Returning pre-rendered HTML for a public influencer profile
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const url = new URL(req.url);
        const rawPlatform = url.searchParams.get("platform") ?? "";
        const rawUsername = url.searchParams.get("username") ?? "";

        if (!rawPlatform || !rawUsername) {
            return new Response("Missing parameters", { status: 400, headers: corsHeaders });
        }

        // Platform allowlist check
        const platform = rawPlatform.toLowerCase().trim();
        if (!VALID_PLATFORMS.includes(platform)) {
            return new Response("Invalid platform", { status: 400, headers: corsHeaders });
        }

        // Username: alphanumeric, dots, underscores, hyphens only. Max 50 chars.
        const sanitizedUsername = rawUsername.replace(/[^a-zA-Z0-9._\-@]/g, "").slice(0, 50);
        if (!sanitizedUsername) {
            return new Response("Invalid username", { status: 400, headers: corsHeaders });
        }

        // HIGH-02 FIX: Rate-limit public profile endpoint by IP to prevent database enumeration.
        // 60 requests/min, 300/hour per IP — generous enough for legitimate bots, blocks scrapers.
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
        const { allowed, retryAfter } = await checkRateLimit(ip, "general", { perMin: 60, perHour: 300 });
        if (!allowed) {
            return new Response(
                JSON.stringify({ error: "Rate limit exceeded" }),
                {
                    status: 429,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                        "Retry-After": String(retryAfter ?? 60),
                    }
                }
            );
        }

        const serviceClient = createPrivilegedClient();

        const { data: profile, error } = await serviceClient
            .from("influencer_profiles")
            .select("full_name, bio, primary_niche, avatar_url, influencer_evaluations(overall_score)")
            .eq("platform", platform)
            .eq("username", sanitizedUsername)
            .eq("enrichment_status", "success") // Only serve fully enriched profiles publicly
            .single();

        if (error || !profile) {
            return new Response("Profile not found", { status: 404, headers: corsHeaders });
        }

        const name = escHtml(profile.full_name || sanitizedUsername);
        const desc = profile.bio
            ? escHtml(profile.bio.slice(0, 200))
            : `View ${name}'s influencer profile, statistics, and brand safety analysis on Mushin.`;
        const score = escHtml(String(profile.influencer_evaluations?.[0]?.overall_score ?? "N/A"));
        const safeUsername = escHtml(sanitizedUsername);
        const safePlatform = escHtml(platform);

        // Standard OpenGraph and Twitter tags for social sharing and SEO indexing
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name} - Mushin Creator Profile</title>
    <meta name="description" content="${desc}">

    <meta property="og:title" content="${name} - Mushin">
    <meta property="og:description" content="${desc}">
    <meta property="og:type" content="profile">
    <meta property="profile:username" content="${safeUsername}">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${name} - Mushin Relevance Score: ${score}">
    <meta name="twitter:description" content="${desc}">

    <script>
      // Automatically redirect to the actual React app route once loaded
      window.location.replace('/influencer/${safePlatform}/${safeUsername}');
    </script>
</head>
<body style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto;">
    <h1>${name} (@${safeUsername})</h1>
    <p><strong>Platform:</strong> ${safePlatform}</p>
    <p><strong>Mushin Relevance Score:</strong> ${score}</p>
    <p><em>Loading full interactive profile...</em></p>
</body>
</html>`;

        return new Response(html, {
            headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        });

    } catch (err: any) {
        // HIGH-04: Never expose internal error details to clients
        console.error("Public Profile Render Error:", err);
        return new Response("An error occurred", { status: 500, headers: corsHeaders });
    }
});
