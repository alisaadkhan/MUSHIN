import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Batch generates text embeddings for all influencer_profiles that lack one.
// Called by cron or manually. Processes 50 profiles per invocation to stay within memory limits.
// Safe to call multiple times — skips profiles that already have embeddings.

const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const corsHeaders = {
    "Access-Control-Allow-Origin": APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 50;

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // Internal-only: requires service role key
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    const HUGGINGFACE_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
    if (!HUGGINGFACE_API_KEY) {
        return new Response(JSON.stringify({ error: "HUGGINGFACE_API_KEY not configured" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
    const { generateEmbedding } = await import("../\_shared/huggingface.ts");

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    // Fetch profiles without embeddings (limit batch size)
    const { data: profiles, error } = await serviceClient
        .from("influencer_profiles")
        .select("id, username, platform, full_name, bio, primary_niche, city")
        .is("embedding", null)
        .eq("enrichment_status", "success")
        .limit(BATCH_SIZE);

    if (error) {
        return new Response(JSON.stringify({ error: "Failed to query profiles" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ message: "All profiles already have embeddings", processed: 0 }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const profile of profiles) {
        try {
            // Build a rich text representation of the profile for embedding
            const text = [
                profile.full_name || profile.username,
                profile.platform,
                profile.primary_niche || "",
                profile.city || "",
                profile.bio || "",
            ].filter(Boolean).join(" | ").slice(0, 2000); // Stay within token limits

            // Generate 1024-dim embedding via HuggingFace BGE-large-en-v1.5
            const vector = await generateEmbedding(text, HUGGINGFACE_API_KEY);
            if (!vector || !Array.isArray(vector)) {
                throw new Error("Invalid embedding response — no vector returned");
            }

            // Store embedding in influencer_profiles
            const { error: updateErr } = await serviceClient
                .from("influencer_profiles")
                .update({ embedding: vector })
                .eq("id", profile.id);

            if (updateErr) throw updateErr;

            // Also store in influencers_cache for match_influencers RPC compatibility
            await serviceClient
                .from("influencers_cache")
                .update({ embedding: vector })
                .eq("platform", profile.platform)
                .eq("username", profile.username);

            success++;
            console.log(`[embeddings] Generated for ${profile.platform}/${profile.username}`);

            // HuggingFace free tier is slower; give 500ms between requests to avoid 429
            await new Promise(r => setTimeout(r, 500));

        } catch (err: any) {
            failed++;
            errors.push(`${profile.platform}/${profile.username}: ${err.message}`);
            console.error(`[embeddings] Failed for ${profile.username}:`, err.message);
        }
    }

    const remaining = await serviceClient
        .from("influencer_profiles")
        .select("id", { count: "exact", head: true })
        .is("embedding", null)
        .eq("enrichment_status", "success");

    return new Response(JSON.stringify({
        processed: profiles.length,
        success,
        failed,
        remaining_without_embeddings: remaining.count ?? "unknown",
        errors: errors.length > 0 ? errors : undefined,
    }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
});
