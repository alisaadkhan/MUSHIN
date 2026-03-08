// supabase/functions/find-lookalikes/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Creator Similarity Engine
//
// Returns 10–15 creators similar to a given profile, using two strategies:
//
//   1. Vector similarity  — cosine distance on HuggingFace BGE-large embeddings
//      (1024-dim). This is the primary signal when an embedding exists.
//
//   2. Tag intersection   — Jaccard similarity on creator_tags. Used as the
//      primary strategy when no embedding exists, and as a secondary boost.
//
// Cross-platform is supported: pass `same_platform_only: false` (default true)
// to surface creators from other platforms with similar content.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMIT_MIN = 5;
const LIMIT_MAX = 15;
const DEFAULT_LIMIT = 12;

/** Clamp result count to [LIMIT_MIN, LIMIT_MAX]. */
function clampLimit(n: unknown): number {
    const parsed = typeof n === "number" ? n : parseInt(String(n), 10);
    if (isNaN(parsed)) return DEFAULT_LIMIT;
    return Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, parsed));
}

/** Compute Jaccard similarity between two tag sets. */
function jaccardSim(a: string[], b: string[]): number {
    if (!a.length || !b.length) return 0;
    const setA = new Set(a.map(t => t.toLowerCase()));
    const setB = new Set(b.map(t => t.toLowerCase()));
    let intersection = 0;
    for (const t of setA) if (setB.has(t)) intersection++;
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const token = authHeader.replace("Bearer ", "");
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } },
        );

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const body = await req.json();
        const { target_profile_id, same_platform_only = true } = body;
        const limit = clampLimit(body.limit ?? body.match_count ?? DEFAULT_LIMIT);

        if (!target_profile_id) {
            return new Response(JSON.stringify({ error: "target_profile_id is required" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { autoRefreshToken: false, persistSession: false } },
        );

        // ── 1. Fetch target profile ───────────────────────────────────────────
        const { data: target, error: profileErr } = await serviceClient
            .from("influencer_profiles")
            .select("id, platform, embedding, bio, primary_niche, full_name, username, tags")
            .eq("id", target_profile_id)
            .single();

        if (profileErr || !target) {
            return new Response(JSON.stringify({ error: "Profile not found" }), {
                status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ── 2. Fetch target's creator_tags ────────────────────────────────────
        const { data: targetTagRows } = await serviceClient
            .from("creator_tags")
            .select("tag, weight")
            .eq("creator_id", target_profile_id)
            .order("weight", { ascending: false })
            .limit(20);

        const targetTags: string[] = targetTagRows?.map((r: any) => r.tag) ?? target.tags ?? [];

        // ── 3a. Vector similarity (primary path when embedding exists) ─────────
        let vectorResults: any[] = [];
        if (target.embedding) {
            const { data: vecRows, error: vecErr } = await serviceClient.rpc(
                "match_influencers",
                {
                    query_embedding: target.embedding,
                    match_threshold: 0.45,          // lower threshold = more results
                    match_count: limit * 3 + 5,     // over-fetch; we'll trim after merging
                    filter_platform: same_platform_only ? target.platform : null,
                },
            );
            if (vecErr) {
                console.warn("[find-lookalikes] Vector search error:", vecErr.message);
            } else {
                vectorResults = (vecRows ?? []).filter((r: any) => r.id !== target_profile_id);
            }
        }

        // ── 3b. Tag-based similarity (fallback + secondary boost) ─────────────
        let tagResults: any[] = [];
        if (targetTags.length > 0) {
            // Fetch profiles that share at least one tag with the target.
            // Use the creator_tags table for this lookup.
            const topTags = targetTags.slice(0, 10);
            const { data: tagProfileIds } = await serviceClient
                .from("creator_tags")
                .select("creator_id")
                .in("tag", topTags)
                .neq("creator_id", target_profile_id);

            const candidateIds = [...new Set((tagProfileIds ?? []).map((r: any) => r.creator_id as string))];

            if (candidateIds.length > 0) {
                let profileQuery = serviceClient
                    .from("influencer_profiles")
                    .select("id, username, platform, full_name, bio, follower_count, engagement_rate, avatar_url, primary_niche, city, tags")
                    .in("id", candidateIds.slice(0, 60)); // cap to avoid huge query

                if (same_platform_only) {
                    profileQuery = profileQuery.eq("platform", target.platform);
                }

                const { data: tagCandidates } = await profileQuery;

                // Also fetch their creator_tags for Jaccard scoring
                const { data: tagRows } = await serviceClient
                    .from("creator_tags")
                    .select("creator_id, tag")
                    .in("creator_id", candidateIds.slice(0, 60));

                const tagsByProfile = new Map<string, string[]>();
                for (const row of (tagRows ?? [])) {
                    const existing = tagsByProfile.get(row.creator_id) ?? [];
                    existing.push(row.tag);
                    tagsByProfile.set(row.creator_id, existing);
                }

                tagResults = (tagCandidates ?? []).map((p: any) => ({
                    ...p,
                    similarity: jaccardSim(targetTags, tagsByProfile.get(p.id) ?? p.tags ?? []),
                    match_method: "tags",
                })).filter((p: any) => p.similarity > 0);
            }
        }

        // ── 4. Niche-based fallback (when neither embedding nor tags produced results) ─
        let nicheResults: any[] = [];
        if (vectorResults.length === 0 && tagResults.length === 0 && target.primary_niche) {
            let nicheQuery = serviceClient
                .from("influencer_profiles")
                .select("id, username, platform, full_name, bio, follower_count, engagement_rate, avatar_url, primary_niche, city, tags")
                .ilike("primary_niche", `%${target.primary_niche}%`)
                .neq("id", target_profile_id)
                .limit(limit * 2);

            if (same_platform_only) {
                nicheQuery = nicheQuery.eq("platform", target.platform);
            }

            const { data: nicheRows } = await nicheQuery;
            nicheResults = (nicheRows ?? []).map((p: any) => ({
                ...p,
                similarity: 0.3 + Math.random() * 0.1, // low-confidence fallback
                match_method: "niche",
            }));
        }

        // ── 5. Merge + deduplicate by profile id ──────────────────────────────
        const seen = new Set<string>();
        const merged: any[] = [];

        // Vector results get priority
        for (const r of vectorResults) {
            if (!seen.has(r.id)) {
                seen.add(r.id);
                merged.push({ ...r, match_method: r.match_method ?? "embedding" });
            }
        }

        // Tag results: boost score if creator also appeared in vector results
        for (const r of tagResults) {
            if (!seen.has(r.id)) {
                seen.add(r.id);
                merged.push(r);
            } else {
                // Already in merged — boost its similarity by tag overlap
                const existing = merged.find(m => m.id === r.id);
                if (existing && r.similarity > 0) {
                    existing.similarity = Math.min(1, existing.similarity + r.similarity * 0.15);
                    existing.match_method = "embedding+tags";
                }
            }
        }

        for (const r of nicheResults) {
            if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
        }

        // ── 6. Sort by similarity descending, trim to limit ───────────────────
        const finalResults = merged
            .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
            .slice(0, limit)
            .map(r => ({
                id:              r.id,
                username:        r.username,
                platform:        r.platform,
                full_name:       r.full_name ?? null,
                bio:             r.bio ?? null,
                follower_count:  r.follower_count ?? null,
                engagement_rate: r.engagement_rate ?? null,
                avatar_url:      r.avatar_url ?? null,
                primary_niche:   r.primary_niche ?? null,
                city:            r.city ?? null,
                tags:            r.tags ?? [],
                similarity:      parseFloat((r.similarity ?? 0).toFixed(3)),
                match_method:    r.match_method ?? "unknown",
            }));

        console.log(`[find-lookalikes] ${target.platform}/${target.username}: ${finalResults.length}/${merged.length} results (limit=${limit})`);

        return new Response(JSON.stringify({
            success: true,
            results: finalResults,
            strategy: target.embedding
                ? (tagResults.length > 0 ? "embedding+tags" : "embedding")
                : (tagResults.length > 0 ? "tags" : "niche"),
            target: { id: target.id, username: target.username, platform: target.platform },
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("[find-lookalikes] Error:", err.message);
        return new Response(JSON.stringify({ error: err.message ?? "Internal server error" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
