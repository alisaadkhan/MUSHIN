// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: profile, error } = await serviceClient
            .from("influencer_profiles")
            .select("*, influencer_evaluations(*)")
            .eq("platform", platform)
            .eq("username", username)
            .single();

        if (error || !profile) {
            return new Response("Profile not found", { status: 404 });
        }

        const name = profile.full_name || username;
        const desc = profile.bio || `View ${name}'s influencer profile, statistics, and brand safety analysis on Influence IQ.`;
        const score = profile.influencer_evaluations?.[0]?.overall_score || "N/A";

        // Standard OpenGraph and Twitter tags for social sharing and SEO indexing
        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${name} - Influence IQ Profile</title>
          <meta name="description" content="${desc}">
          
          <meta property="og:title" content="${name} - Influence IQ">
          <meta property="og:description" content="${desc}">
          <meta property="og:type" content="profile">
          <meta property="profile:username" content="${username}">
          
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:title" content="${name} - Influence IQ Score: ${score}">
          <meta name="twitter:description" content="${desc}">
          
          <script>
            // Automatically redirect to the actual React app route once loaded
            window.location.replace('/influencer/${platform}/${username}');
          </script>
      </head>
      <body style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto;">
          <h1>${name} (@${username})</h1>
          <p><strong>Platform:</strong> ${platform}</p>
          <p><strong>Niche:</strong> ${profile.primary_niche}</p>
          <p><strong>Influence IQ Score:</strong> ${score}</p>
          <p>${profile.bio}</p>
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
