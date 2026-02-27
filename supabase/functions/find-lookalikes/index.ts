import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

        const { target_profile_id, match_count = 5 } = await req.json();
        if (!target_profile_id) throw new Error("target_profile_id is required");

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // 1. Fetch Target Profile Embedding
        const { data: targetProfile, error: profileErr } = await serviceClient
            .from("influencer_profiles")
            .select("embedding, platform")
            .eq("id", target_profile_id)
            .single();

        if (profileErr || !targetProfile?.embedding) {
            throw new Error("Target profile embedding not found or profile does not exist.");
        }

        // 2. Perform Similarity Search excluding the target itself
        const { data: lookalikes, error: searchErr } = await serviceClient.rpc(
            "match_influencers",
            {
                query_embedding: targetProfile.embedding,
                match_threshold: 0.7, // Slightly higher threshold for "lookalikes"
                match_count: match_count + 1, // +1 because the target will match itself 1.0
                filter_platform: targetProfile.platform // Match within same platform usually
            }
        );

        if (searchErr) throw searchErr;

        // Filter out the target itself from the results
        const filteredLookalikes = (lookalikes || []).filter((l: any) => l.id !== target_profile_id).slice(0, match_count);

        return new Response(JSON.stringify({
            success: true,
            results: filteredLookalikes
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("Lookalikes Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
