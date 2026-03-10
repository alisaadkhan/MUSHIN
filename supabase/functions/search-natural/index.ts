// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis";
import { generateEmbedding } from "../_shared/huggingface.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "https://mushin.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Redis client if env vars are present (fallback to none if missing)
let redis: Redis | null = null;
if (Deno.env.get("UPSTASH_REDIS_REST_URL") && Deno.env.get("UPSTASH_REDIS_REST_TOKEN")) {
    redis = new Redis({
        url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
        token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
    });
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

        const { data: workspaceId } = await supabase.rpc("get_user_workspace_id");
        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: ws } = await serviceClient
            .from("workspaces")
            .select("ai_credits_remaining")
            .eq("id", workspaceId)
            .single();

        if (!ws || ws.ai_credits_remaining <= 0) {
            return new Response(JSON.stringify({ error: "No AI credits remaining" }), {
                status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const { query, platform } = await req.json();
        if (!query) throw new Error("Query is required");

        // Attempt to Fetch from Cache
        const cacheKey = `search:${query.toLowerCase().trim()}:${platform || 'all'}`;
        if (redis) {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    console.log("Returned cached results for:", query);
                    return new Response(JSON.stringify({ results: cached, cached: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
            } catch (e) { console.warn("Redis Fetch Error", e); }
        }

        const HUGGINGFACE_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
        if (!HUGGINGFACE_API_KEY) {
            return new Response(JSON.stringify({ error: "No AI credits remaining" }), {
                status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 1. Generate Embedding for the Search Query via HuggingFace BGE-large
        const vector = await generateEmbedding(query, HUGGINGFACE_API_KEY);

        // 2. Perform Similarity Search
        const { data: influencers, error: searchErr } = await serviceClient.rpc(
            "match_influencers",
            {
                query_embedding: vector,
                match_threshold: 0.6,
                match_count: 10,
                filter_platform: platform || null
            }
        );

        if (searchErr) throw searchErr;

        try {
            await serviceClient.rpc("consume_ai_credit", { ws_id: workspaceId });
        } catch (creditErr: any) {
            if (creditErr.code === "P0001") {
                return new Response(JSON.stringify({ error: "No AI credits remaining" }), {
                    status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        }

        const hydratedResults = influencers || [];

        // Save to Cache if possible
        if (redis && hydratedResults.length > 0) {
            try {
                // Cache results for 1 hour to prevent duplicate expensive LLM calls
                await redis.set(cacheKey, JSON.stringify(hydratedResults), { ex: 3600 });
            } catch (e) { console.warn("Redis Save Error", e); }
        }

        return new Response(JSON.stringify({
            results: hydratedResults,
            credits_remaining: ws.ai_credits_remaining - 1
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("AI Search Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
