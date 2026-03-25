import { isSuperAdmin, performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis";
import { generateEmbedding } from "../_shared/huggingface.ts";
const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";

function buildCorsHeaders(req: Request) {
    const origin = req.headers.get("Origin") ?? "";
    const allowed = new Set<string>([
        APP_URL,
        "http://localhost:5173",
        "http://localhost:3000",
    ]);
    if (origin.endsWith(".vercel.app")) {
        allowed.add(origin);
    }
    return {
        "Access-Control-Allow-Origin": allowed.has(origin) ? origin : APP_URL,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    };
}

// CSRF origin guard — rejects cross-origin state-mutating requests
function isOriginAllowed(req: Request): boolean {
    const origin = req.headers.get("Origin");
    if (!origin) return true; // server-to-server (no Origin header) — allowed
    return origin === APP_URL
        || origin === "http://localhost:5173"
        || origin === "http://localhost:3000"
        || origin.endsWith(".vercel.app");
}

// Initialize Redis client if env vars are present (fallback to none if missing)
let redis: Redis | null = null;
if (Deno.env.get("UPSTASH_REDIS_REST_URL") && Deno.env.get("UPSTASH_REDIS_REST_TOKEN")) {
    redis = new Redis({
        url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
        token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
    });
}

Deno.serve(async (req) => {
    const corsHeaders = buildCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // CSRF: reject requests from unknown origins (MED-07)
    if (!isOriginAllowed(req)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

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

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const { data: workspaceId } = await supabase.rpc("get_user_workspace_id");
        if (!workspaceId) {
            return new Response(JSON.stringify({ error: "No workspace found" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        const serviceClient = await performPrivilegedWrite({
            authHeader: req.headers.get("Authorization"),
            action: "gateway:privileged-client-bootstrap",
            endpoint: "search-natural",
            ipAddress,
            execute: async (_ctx, client) => client,
        });

        const callerIsSuperAdmin = await isSuperAdmin(userData.user.id);

        const { data: ws } = await serviceClient
            .from("workspaces")
            .select("ai_credits_remaining")
            .eq("id", workspaceId)
            .single();

        if (!callerIsSuperAdmin && (!ws || ws.ai_credits_remaining <= 0)) {
            return new Response(JSON.stringify({ error: "No AI credits remaining" }), {
                status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const body = await req.json();
        const rawQuery: string = body?.query ?? "";
        const platform: string | null = body?.platform ?? null;

        if (!rawQuery || typeof rawQuery !== "string") {
            return new Response(JSON.stringify({ error: "Query is required" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Sanitize query: max 500 chars, strip control chars (prompt injection / DoS prevention)
        const query = rawQuery.trim().replace(/[\x00-\x1F\x7F]/g, "").slice(0, 500);
        if (query.length < 2) {
            return new Response(JSON.stringify({ error: "Query too short" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Attempt to Fetch from Cache
        const cacheKey = `search:${query.toLowerCase().trim()}:${platform || 'all'}`;
        if (redis) {
            try {
                const cached = await redis.get(cacheKey);
                if (cached) {
                    console.log("Returned cached results for:", query);
                    return new Response(JSON.stringify({ results: cached, cached: true }), {
                        headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }
            } catch (e) { console.warn("Redis Fetch Error", e); }
        }

        const HUGGINGFACE_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
        if (!HUGGINGFACE_API_KEY) {
            return new Response(JSON.stringify({ error: "AI search is not available" }), {
                status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // ============================================================
        // CRIT-03 FIX: Deduct credit BEFORE the expensive HuggingFace
        // call. This closes the TOCTOU race window where N simultaneous
        // requests all pass the balance check and each get a free search.
        // The consume_ai_credit() SQL function is atomic and raises P0001
        // on insufficient balance, so no negative balances are possible.
        // ============================================================
        if (!callerIsSuperAdmin) {
            try {
                await serviceClient.rpc("consume_ai_credit", { ws_id: workspaceId });
            } catch (creditErr: any) {
                if (creditErr.code === "P0001") {
                    return new Response(JSON.stringify({ error: "No AI credits remaining" }), {
                        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }
                throw creditErr;
            }
        }

        // 1. Generate Embedding for the Search Query via HuggingFace BGE-large
        let vector: number[];
        try {
            vector = await generateEmbedding(query, HUGGINGFACE_API_KEY);
        } catch (embErr: any) {
            // Refund the credit — the embedding failed before any value was delivered
            if (!callerIsSuperAdmin) {
                await serviceClient.rpc("admin_adjust_credits", {
                    ws_id: workspaceId, credit_type: "ai", delta: 1
                }).catch(() => null);
            }
            console.error("HuggingFace embedding error:", embErr?.message);
            return new Response(JSON.stringify({ error: "AI search temporarily unavailable. Your credit has been refunded." }), {
                status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

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

        if (searchErr) {
            console.error("match_influencers RPC error:", searchErr.message);
            throw searchErr;
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
            credits_remaining: callerIsSuperAdmin ? Number.MAX_SAFE_INTEGER : ws.ai_credits_remaining - 1
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        // HIGH-04: Never expose raw error messages/stack traces to clients
        console.error("AI Search Error:", err);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
