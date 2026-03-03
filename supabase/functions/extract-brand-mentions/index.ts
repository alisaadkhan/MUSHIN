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

        const { profile_id } = await req.json();
        if (!profile_id) {
            return new Response(JSON.stringify({ error: "profile_id required" }), { status: 400, headers: corsHeaders });
        }

        // Validate calling user's auth
        const token = authHeader.replace("Bearer ", "");
        const anonClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );
        const { data: userData, error: userError } = await anonClient.auth.getUser(token);
        if (userError || !userData?.user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Fetch batch of posts to analyze
        const { data: posts, error: postsErr } = await serviceClient
            .from("influencer_posts")
            .select("id, caption, posted_at, image_urls")
            .eq("profile_id", profile_id)
            .limit(30)
            .order("posted_at", { ascending: false });

        if (postsErr || !posts) throw new Error("Failed to fetch posts");
        if (posts.length === 0) {
            return new Response(JSON.stringify({ message: "No posts found to analyze" }), { headers: corsHeaders });
        }

        // Process in a single AI prompt via a compressed JSON object for efficiency
        const postsPayload = posts.map(p => ({ id: p.id, caption: p.caption, date: p.posted_at }));

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        const systemPrompt = `You are a Named Entity Recognition (NER) system for influencer marketing. Given a JSON list of posts with captions, identify ANY brand names mentioned.
Return a pure JSON list of objects matching the schema.`;

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
                    { role: "user", content: `Analyze these posts:\n${JSON.stringify(postsPayload).substring(0, 4000)}` }
                ],
                tools: [{
                    type: "function",
                    function: {
                        name: "extract_mentions",
                        parameters: {
                            type: "object",
                            properties: {
                                mentions: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            post_id: { type: "string", description: "The ID of the post containing the mention" },
                                            brand_name: { type: "string" },
                                            category: { type: "string", description: "e.g., Apparel, Tech, Food, Beauty" }
                                        },
                                        required: ["post_id", "brand_name", "category"]
                                    }
                                }
                            },
                            required: ["mentions"],
                            additionalProperties: false
                        }
                    }
                }],
                tool_choice: { type: "function", function: { name: "extract_mentions" } }
            }),
        });

        if (!aiRes.ok) throw new Error(`AI Gateway Error ${aiRes.status}`);

        const aiData = await aiRes.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) throw new Error("No tool call returned from AI");

        const analysis = JSON.parse(toolCall.function.arguments);

        if (analysis.mentions && analysis.mentions.length > 0) {
            // Map to DB schema
            const mentionsToInsert = analysis.mentions.map((m: any) => ({
                influencer_id: profile_id,
                brand_name: m.brand_name,
                post_id: m.post_id,
                category: m.category,
                // Find the original post date to set mentioned_at accurately
                mentioned_at: posts.find(p => p.id === m.post_id)?.posted_at || new Date().toISOString()
            }));

            const { error: insertErr } = await serviceClient.from("brand_mentions").insert(mentionsToInsert);
            if (insertErr) {
                console.error("Error inserting mentions:", insertErr);
                throw new Error("Failed to insert mentions into DB");
            }
        }

        return new Response(JSON.stringify({ success: true, count: analysis.mentions?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error(err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
