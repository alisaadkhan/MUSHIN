import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Prevent XSS by escaping all HTML special characters before injecting into templates. */
function escHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extremely basic SSR generation for SEO purposes
// Returning pre-rendered HTML for a public influencer profile
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const url = new URL(req.url);
        const platform = url.searchParams.get("platform");
        const username = url.searchParams.get("username");

        if (!platform || !username) {
            return new Response("Missing parameters", { status: 400 });
        }

        // ADD AFTER THE ABOVE — sanitize inputs before DB query
        const VALID_PLATFORMS = ["instagram", "youtube", "tiktok"];
        if (!VALID_PLATFORMS.includes(platform.toLowerCase())) {
            return new Response("Invalid platform", { status: 400 });
        }
        // Username: alphanumeric, dots, underscores, hyphens only. Max 50 chars.
        const sanitizedUsername = username.replace(/[^a-zA-Z0-9._\-@]/g, "").slice(0, 50);
        if (!sanitizedUsername) {
            return new Response("Invalid username", { status: 400 });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: profile, error } = await serviceClient
            .from("influencer_profiles")
            .select("*, influencer_evaluations(*)")
            .eq("platform", platform.toLowerCase())
            .eq("username", sanitizedUsername)
            .single();

        if (error || !profile) {
            return new Response("Profile not found", { status: 404 });
        }

        const name = profile.full_name || username;
        const desc = profile.bio || `View ${escHtml(name)}'s influencer profile, statistics, and brand safety analysis on Mushin.`;
        const score = profile.influencer_evaluations?.[0]?.overall_score || "N/A";

        // Standard OpenGraph and Twitter tags for social sharing and SEO indexing
        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escHtml(name)} - Mushin Creator Profile</title>
          <meta name="description" content="${escHtml(desc)}">
          
          <meta property="og:title" content="${escHtml(name)} - Mushin">
          <meta property="og:description" content="${escHtml(desc)}">
          <meta property="og:type" content="profile">
          <meta property="profile:username" content="${escHtml(username)}">
          
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:title" content="${escHtml(name)} - Mushin Relevance Score: ${escHtml(score)}">
          <meta name="twitter:description" content="${escHtml(desc)}">
          
          <script>
            // Automatically redirect to the actual React app route once loaded
            window.location.replace('/influencer/${escHtml(platform)}/${escHtml(sanitizedUsername)}');
          </script>
      </head>
      <body style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto;">
          <h1>${escHtml(name)} (@${escHtml(sanitizedUsername)})</h1>
          <p><strong>Platform:</strong> ${escHtml(platform)}</p>
          <p><strong>Niche:</strong> ${escHtml(profile.primary_niche)}</p>
          <p><strong>Mushin Relevance Score:</strong> ${escHtml(score)}</p>
          <p>${escHtml(profile.bio)}</p>
          <p><em>Loading full interactive profile...</em></p>
      </body>
      </html>
    `;

        return new Response(html, {
            headers: { ...corsHeaders, "Content-Type": "text/html" },
        });

    } catch (err: any) {
        console.error("Public Profile Render Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
