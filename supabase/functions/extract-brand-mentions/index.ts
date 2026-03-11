import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const corsHeaders = {
    "Access-Control-Allow-Origin": APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};



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

        const HF_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
        const { generateText: hfGenerate, extractJsonFromText } = await import("../\_shared/huggingface.ts");

        let analysis: { mentions: Array<{ post_id: string; brand_name: string; category: string }> } = { mentions: [] };

        if (HF_API_KEY) {
            const systemPrompt = `You are a Named Entity Recognition (NER) system for influencer marketing. Given a JSON list of posts, identify brand names mentioned in captions.
Return ONLY a JSON object: {"mentions":[{"post_id":"id","brand_name":"Brand","category":"Tech"}]}
If no brands are found, return {"mentions":[]}. Return ONLY the JSON.`;
            try {
                const rawText = await hfGenerate(
                    systemPrompt,
                    `Analyze posts:\n${JSON.stringify(postsPayload).substring(0, 3000)}`,
                    HF_API_KEY,
                    { maxTokens: 400, temperature: 0.1 }
                );
                const parsed = extractJsonFromText(rawText) as any;
                if (Array.isArray(parsed?.mentions)) analysis = parsed;
            } catch (aiErr: any) {
                console.warn("[extract-brand-mentions] AI failed:", aiErr.message);
                // Fallback: no mentions extracted — non-blocking
            }
        }

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
        return safeErrorResponse(err, "[extract-brand-mentions]", corsHeaders);
    }
});
