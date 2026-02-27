import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
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
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: workspaceId, error: wsError } = await supabase.rpc("get_user_workspace_id");
        if (wsError || !workspaceId) {
            return new Response(JSON.stringify({ error: "No workspace found" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: workspace } = await supabase
            .from("workspaces")
            .select("enrichment_credits_remaining")
            .eq("id", workspaceId)
            .single();

        if (!workspace || workspace.enrichment_credits_remaining <= 0) {
            return new Response(
                JSON.stringify({ error: "No enrichment credits remaining" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const bodyText = await req.text();
        let body;
        try {
            body = JSON.parse(bodyText);
        } catch {
            return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { username, platform, full_name, bio, extracted_followers } = body;
        if (!username || !platform) {
            return new Response(JSON.stringify({ error: "username and platform are required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Generate mock enriched data
        const followers = extracted_followers || Math.floor(Math.random() * 500000) + 10000;
        const baseLikes = Math.floor(followers * (Math.random() * 0.08 + 0.02)); // 2-10% ER

        const metrics = {
            followers,
            engagement_rate: ((baseLikes / followers) * 100).toFixed(2),
            avg_likes: baseLikes,
            avg_comments: Math.floor(baseLikes * 0.05)
        };

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Upsert Profile
        const { data: profile, error: profileErr } = await serviceClient
            .from("influencer_profiles")
            .upsert(
                {
                    platform,
                    username,
                    full_name: full_name || username,
                    bio: bio || `Verified ${platform} creator. Official account of ${username}. Contact for business strictly through email! 📩`,
                    enriched_at: new Date().toISOString(),
                    primary_niche: "Lifestyle",
                    metrics
                },
                { onConflict: "platform,username", ignoreDuplicates: false }
            )
            .select()
            .single();

        if (profileErr) {
            console.error("Profile Upsert Error:", profileErr);
            throw profileErr;
        }

        // Generate and Insert Posts (20 most recent)
        const posts = Array.from({ length: 20 }).map((_, i) => {
            const isSponsored = Math.random() > 0.8;
            const daysAgo = Math.floor(Math.random() * 60) + i;
            return {
                profile_id: profile.id,
                platform_post_id: `${platform}_${username}_mockpost_${i}`,
                caption: isSponsored
                    ? `Loving this new product, absolutely changed my routine! #sponsor #ad @brand`
                    : `Just a regular day taking a selfie 😎 ✨ vibe check!`,
                image_urls: [`https://picsum.photos/seed/${profile.id}${i}/400/400`],
                posted_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
                likes: Math.floor(baseLikes * (0.5 + Math.random() * 1.5)),
                comments: Math.floor(baseLikes * 0.05 * (0.5 + Math.random() * 1.5)),
                is_sponsored: isSponsored
            };
        });

        const { error: postsErr } = await serviceClient
            .from("influencer_posts")
            .upsert(posts, { onConflict: "profile_id,platform_post_id", ignoreDuplicates: true });

        if (postsErr) {
            console.error("Posts Upsert Error:", postsErr);
        }

        // Insert Follower History
        await serviceClient.from("follower_history").insert({
            profile_id: profile.id,
            follower_count: followers
        });

        // Generate some historical follower data points to show a chart
        const historyPoints = [];
        for (let i = 1; i <= 6; i++) {
            historyPoints.push({
                profile_id: profile.id,
                recorded_at: new Date(Date.now() - i * 30 * 86400000).toISOString(),
                follower_count: Math.floor(followers * (1 - (i * 0.02) + (Math.random() * 0.01)))
            });
        }
        await serviceClient.from("follower_history").insert(historyPoints);

        // Deduct Credit
        await serviceClient
            .from("workspaces")
            .update({ enrichment_credits_remaining: workspace.enrichment_credits_remaining - 1 })
            .eq("id", workspaceId);

        // Log Usage
        await serviceClient.from("credits_usage").insert({
            workspace_id: workspaceId,
            action_type: "enrichment",
            amount: 1
        });

        return new Response(
            JSON.stringify({ success: true, profile, posts, credits_remaining: workspace.enrichment_credits_remaining - 1 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err: any) {
        console.error("Enrichment error:", err);
        return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
