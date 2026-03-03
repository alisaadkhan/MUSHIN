import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

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

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

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

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        // Analyze Niche and Brand Safety
        const systemPrompt = `You are a social media content analyzer. Given a collection of an influencer's recent post captions, analyze them and extract:
1. 2 to 5 highly specific Niche Categories from this list: Food, Fashion, Beauty, Tech, Fitness, Travel, Gaming, Music, Education, Comedy, Parenting, Entertainment, Lifestyle, Finance, Health, Sports, News, Photography, Art. 
   - If the content does not strongly fit any specific category, use 'General'.
2. Aesthetic/Style tags (e.g., 'Minimalist', 'Vibrant', 'Casual').
3. Brand Safety Rating: analyze for profanity, extreme politics, adult content, or highly controversial topics.
4. Extracted Brand Mentions: A list of any brand names explicitly mentioned in the captions.

Return ONLY pure JSON matching the provided tool schema.`;

        const aiRes = await fetch(AI_GATEWAY, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Analyze these captions:\n${combinedCaptions.substring(0, 3000)}` } // Limit tokens
                ],
                tools: [{
                    type: "function",
                    function: {
                        name: "content_analysis",
                        parameters: {
                            type: "object",
                            properties: {
                                niches: { type: "array", items: { type: "string" } },
                                aesthetics: { type: "array", items: { type: "string" } },
                                brand_safety: {
                                    type: "object",
                                    properties: {
                                        rating: { type: "string", enum: ["safe", "caution", "risk"] },
                                        flags: { type: "array", items: { type: "string" } }
                                    },
                                    required: ["rating", "flags"]
                                },
                                brand_mentions: { type: "array", items: { type: "string" } }
                            },
                            required: ["niches", "aesthetics", "brand_safety", "brand_mentions"],
                            additionalProperties: false
                        }
                    }
                }],
                tool_choice: { type: "function", function: { name: "content_analysis" } }
            }),
        });

        if (!aiRes.ok) throw new Error(`AI Gateway Error ${aiRes.status}`);

        const aiData = await aiRes.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) throw new Error("No tool call returned from AI");

        const analysis = JSON.parse(toolCall.function.arguments);

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
        console.error(err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
