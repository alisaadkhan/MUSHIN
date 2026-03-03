import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Batch generates text embeddings for all influencer_profiles that lack one.
// Called by cron or manually. Processes 50 profiles per invocation to stay within memory limits.
// Safe to call multiple times — skips profiles that already have embeddings.

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

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
        return new Response(JSON.stringify({ error: error.message }), {
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

            // Generate embedding via Lovable AI gateway (OpenAI text-embedding-3-small)
            const embeddingRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    input: text,
                    model: "text-embedding-3-small",
                }),
            });

            if (!embeddingRes.ok) {
                throw new Error(`Embedding API returned ${embeddingRes.status}: ${await embeddingRes.text()}`);
            }

            const embeddingData = await embeddingRes.json();
            const vector = embeddingData.data?.[0]?.embedding;
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

            // Rate limit: 20 embeddings/sec is safe for OpenAI tier-1
            await new Promise(r => setTimeout(r, 100));

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
