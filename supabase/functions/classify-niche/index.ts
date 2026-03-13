import { performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";
import { corsHeaders } from "../_shared/rate_limit.ts";
import { generateText, extractJsonFromText, extractTagsFromBio, normalizeTags } from "../\_shared/huggingface.ts";
Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }
        const supabaseUser = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(authHeader.replace("Bearer ", ""));
        if (authErr || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const { profile_id } = await req.json();
        if (!profile_id) {
            return new Response(JSON.stringify({ error: "profile_id required" }), { status: 400, headers: corsHeaders });
        }

        const serviceClient = await performPrivilegedWrite({
        authHeader: req.headers.get("Authorization"),
        action: "gateway:privileged-client-bootstrap",
        execute: async (_ctx, client) => client,
    });

        // Fetch up to 20 recent posts for this profile
        const { data: posts, error: postsErr } = await serviceClient
            .from("influencer_posts")
            .select("id, caption")
            .eq("profile_id", profile_id)
            .limit(20);

        if (postsErr || !posts) throw new Error("Failed to fetch posts");
        if (posts.length === 0) {
            return new Response(JSON.stringify({ message: "No posts found to classify" }), { headers: corsHeaders });
        }

        // Combine captions to understand the overall aesthetic and niche
        const combinedCaptions = posts.map(p => p.caption).filter(Boolean).join("\n---\n");

        const HF_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY");

        let analysis: any;

        if (HF_API_KEY) {
            // AI path: Mistral-7B-Instruct generates structured JSON
            const systemPrompt = `You are a social media content analyzer. Analyze influencer post captions and return ONLY a JSON object with this exact structure:
{"niches":["Food"],"aesthetics":["Vibrant"],"brand_safety":{"rating":"safe","flags":[]},"brand_mentions":[]}
Valid niche values: Food, Fashion, Beauty, Tech, Fitness, Travel, Gaming, Music, Education, Comedy, Parenting, Entertainment, Lifestyle, Finance, Health, Sports, News, Photography, Art, General.
Brand safety rating: safe, caution, or risk. Return ONLY the JSON, no explanation.`;

            try {
                const rawText = await generateText(
                    systemPrompt,
                    `Analyze these captions:\n${combinedCaptions.substring(0, 2500)}`,
                    HF_API_KEY,
                    { maxTokens: 300, temperature: 0.1 }
                );
                analysis = extractJsonFromText(rawText);
                // Validate minimum structure
                if (!Array.isArray(analysis.niches)) throw new Error("niches missing");
                if (!analysis.brand_safety) analysis.brand_safety = { rating: "safe", flags: [] };
                if (!Array.isArray(analysis.brand_mentions)) analysis.brand_mentions = [];
                if (!Array.isArray(analysis.aesthetics)) analysis.aesthetics = [];
            } catch (aiErr: any) {
                console.warn("[classify-niche] AI failed, using keyword fallback:", aiErr.message);
                // Fallback: keyword-based classification
                const { inferNiche } = await import("../\_shared/niche.ts");
                const nicheData = inferNiche("", combinedCaptions.substring(0, 500), "");
                analysis = {
                    niches: nicheData.niche !== "General" ? [nicheData.niche] : ["General"],
                    aesthetics: [],
                    brand_safety: { rating: "safe", flags: [] },
                    brand_mentions: [],
                };
            }
        } else {
            // No API key: keyword fallback only
            const { inferNiche } = await import("../\_shared/niche.ts");
            const nicheData = inferNiche("", combinedCaptions.substring(0, 500), "");
            analysis = {
                niches: nicheData.niche !== "General" ? [nicheData.niche] : ["General"],
                aesthetics: [],
                brand_safety: { rating: "safe", flags: [] },
                brand_mentions: [],
            };
        }

        // 1. Update Profile with Niches & Brand Safety
        await serviceClient
            .from("influencer_profiles")
            .update({
                primary_niche: analysis.niches[0] || "General",
                secondary_niches: analysis.niches.slice(1),
                brand_safety: analysis.brand_safety
            })
            .eq("id", profile_id);

        // 2. Insert Brand Mentions
        if (analysis.brand_mentions && analysis.brand_mentions.length > 0) {
            // We link these generally to the profile for the timeline, using the most recent post as reference
            const recentPostId = posts[0].id;
            const mentionsToInsert = analysis.brand_mentions.map((brand: string) => ({
                influencer_id: profile_id,
                brand_name: brand,
                post_id: recentPostId,
                category: "Detected Mention"
            }));

            await serviceClient.from("brand_mentions").insert(mentionsToInsert);
        }

        // 3. Update the posts with aesthetic tags (apply generally to the recent batch)
        // In a full production system this would be per-post image vision analysis, 
        // but for text-based batching we apply aesthetic keywords.
        for (const post of posts) {
            await serviceClient
                .from("influencer_posts")
                .update({ ai_tags: analysis.aesthetics })
                .eq("id", post.id);
        }

        return new Response(JSON.stringify({ success: true, analysis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        return safeErrorResponse(err, "[classify-niche]", corsHeaders);
    }
});
