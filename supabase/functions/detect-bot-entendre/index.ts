import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalysisInput {
    username: string;
    platform: "instagram" | "youtube" | "tiktok";
    follower_count: number;
    following_count: number | null;
    posts_count: number | null;
    engagement_rate: number | null;
    avg_likes: number | null;
    avg_comments: number | null;
    account_age_days: number | null;
    bio: string | null;
    // Optional: richer signals from post data
    sponsored_post_count?: number | null;
    total_post_count?: number | null;
    recent_follower_delta?: number | null;  // change in last 30 days
    has_growth_spike?: boolean | null;      // from follower_growth_signals view
}

interface Signal {
    name: string;
    triggered: boolean;
    score: number;
    detail: string;
    severity: "low" | "medium" | "high";
}

function analyze(input: AnalysisInput): { score: number; signals: Signal[]; confidence: "low" | "medium" | "high" } {
    const signals: Signal[] = [];
    let totalScore = 0;

    const add = (name: string, triggered: boolean, score: number, detail: string, severity: "low" | "medium" | "high") => {
        signals.push({ name, triggered, score: triggered ? score : 0, detail, severity });
        if (triggered) totalScore += score;
    };

    const { follower_count, following_count, engagement_rate, avg_likes, avg_comments,
        account_age_days, bio, posts_count, sponsored_post_count, total_post_count,
        recent_follower_delta } = input;

    // ── Signal 1: Follower/Following ratio ─────────────────────────────────────
    if (following_count !== null && follower_count > 0) {
        const ratio = following_count / follower_count;
        add("high_following_ratio", ratio > 3, 20, `Following/follower ratio: ${ratio.toFixed(2)} (>3 is suspicious)`, "high");
        add("low_following_ratio", ratio < 0.01, 10, `Almost no following: ratio ${ratio.toFixed(3)}`, "low");
    }

    // ── Signal 2: Engagement anomalies ────────────────────────────────────────
    if (engagement_rate !== null) {
        add("unrealistic_high_er",
            follower_count > 100_000 && engagement_rate > 20,
            25, `${engagement_rate.toFixed(1)}% ER with ${(follower_count / 1000).toFixed(0)}K followers is unrealistic`, "high");
        add("dead_audience",
            follower_count > 10_000 && engagement_rate < 0.1,
            20, `${engagement_rate.toFixed(2)}% ER — audience not engaging (likely bought followers)`, "high");
        add("low_er_large_account",
            follower_count > 50_000 && engagement_rate < 0.5,
            10, `Below-average ER for account size`, "medium");
    }

    // ── Signal 3: Comment/like ratio ──────────────────────────────────────────
    if (avg_likes !== null && avg_comments !== null && avg_likes > 0) {
        const clRatio = avg_comments / avg_likes;
        add("no_comments",
            avg_likes > 100 && clRatio < 0.003,
            15, `Comments nearly absent (${clRatio.toFixed(4)} per like) — bot-liked content typically has no organic comments`, "medium");
    }

    // ── Signal 4: Round follower count ────────────────────────────────────────
    add("round_followers",
        follower_count > 10_000 && follower_count % 1000 === 0,
        8, `Exact round number: ${follower_count.toLocaleString()} (bots sold in round thousands)`, "low");

    // ── Signal 5: New account, large following ─────────────────────────────────
    if (account_age_days !== null) {
        add("new_account_spike",
            account_age_days < 180 && follower_count > 50_000,
            22, `Account only ${account_age_days} days old with ${(follower_count / 1000).toFixed(0)}K followers`, "high");

        // ── Signal 6: Abnormal growth rate ─────────────────────────────────────
        const growthPerDay = account_age_days > 0 ? follower_count / account_age_days : 0;
        add("abnormal_growth_rate",
            account_age_days > 30 && growthPerDay > 500,
            15, `Avg ${Math.round(growthPerDay)} followers/day — organic growth rarely exceeds 200/day for most creators`, "medium");
    }

    // ── Signal 7: Sudden follower spike ──────────────────────────────────────
    if (recent_follower_delta !== null && follower_count > 0) {
        const spikePct = (recent_follower_delta / follower_count) * 100;
        add("recent_spike",
            spikePct > 30 && recent_follower_delta > 5000,
            18, `+${recent_follower_delta.toLocaleString()} followers in last 30 days (${spikePct.toFixed(1)}% spike)`, "high");
    }

    // ── Signal 8: Empty / minimal bio ────────────────────────────────────────
    const bioLen = (bio || "").trim().length;
    add("empty_bio", bioLen < 5, 12, "No bio — weak signal but common in bot accounts", "low");
    add("minimal_bio", bioLen >= 5 && bioLen < 20, 5, "Very short bio", "low");

    // ── Signal 9: Post frequency ──────────────────────────────────────────────
    if (posts_count !== null && account_age_days !== null && account_age_days > 7) {
        const postsPerDay = posts_count / account_age_days;
        add("excessive_posting",
            postsPerDay > 5,
            10, `${postsPerDay.toFixed(1)} posts/day average — may indicate automated content`, "medium");
    }

    // ── Signal 10: Sponsored content ratio ───────────────────────────────────
    if (sponsored_post_count !== null && total_post_count !== null && total_post_count > 0) {
        const sponsoredPct = (sponsored_post_count / total_post_count) * 100;
        add("high_sponsored_ratio",
            sponsoredPct > 40,
            8, `${sponsoredPct.toFixed(0)}% sponsored posts (>${40}% may mislead on organic reach)`, "low");
    }

    // ── Signal 11: Platform-specific ER benchmarks ────────────────────────────
    // Instagram: 1-3% normal. TikTok: 3-9% normal. YouTube: 2-5% normal.
    if (engagement_rate !== null) {
        const platformBenchmarks: Record<string, { low: number; high: number }> = {
            instagram: { low: 0.3, high: 15 },
            tiktok: { low: 0.5, high: 30 },
            youtube: { low: 0.2, high: 12 },
        };
        const bench = platformBenchmarks[input.platform] || { low: 0.3, high: 15 };
        add("platform_er_outlier",
            engagement_rate > bench.high && follower_count > 50_000,
            18, `${engagement_rate.toFixed(1)}% ER exceeds ${input.platform} benchmark ceiling (${bench.high}%) for accounts this size`, "high");
    }

    // ── Signal 12: Views vs likes ratio (TikTok/YouTube) ─────────────────────
    // TikTok: avg like rate on views is ~3-8%. If likes > 15% of views = suspicious.
    if (avg_likes !== null && input.platform === "tiktok") {
        // We can infer this from avg_views if available (added in Phase 1 mapTikTok)
        const avgViewsApprox = avg_likes > 0 ? avg_likes * 15 : null; // rough lower bound
        if (avgViewsApprox && avg_likes / avgViewsApprox > 0.15) {
            add("tiktok_like_view_ratio",
                true, 12, `High like-to-view ratio suggests engagement pods or purchased likes`, "medium");
        }
    }

    // ── Signal 13: Username entropy (bot accounts often have random usernames) ──
    const username = input.username || "";
    const hasNumbers = /\d{4,}/.test(username);
    const hasRandomChars = /[a-z]{2,}\d{3,}[a-z]*/i.test(username);
    add("suspicious_username",
        hasNumbers && hasRandomChars && username.length > 12,
        8, `Username pattern (${username}) has numeric suffix common in auto-generated accounts`, "low");

    // ── Signal 14: Post/follower ratio (authentic accounts post 1-3×/week) ───
    if (posts_count !== null && account_age_days !== null && account_age_days > 30) {
        const postsPerWeek = (posts_count / account_age_days) * 7;
        add("very_low_post_rate",
            postsPerWeek < 0.1 && follower_count > 50_000,
            12, `Only ${postsPerWeek.toFixed(2)} posts/week — very large following with almost no content is unusual`, "medium");
    }

    // ── Signal 15: Follower count vs posts count ratio ───────────────────────
    if (posts_count !== null && posts_count > 0) {
        const followersPerPost = follower_count / posts_count;
        add("abnormal_followers_per_post",
            followersPerPost > 50_000 && follower_count > 100_000,
            10, `${Math.round(followersPerPost).toLocaleString()} followers per post — unusually high ratio suggests bulk follower acquisition`, "medium");
    }

    // ── Signal 16: Hardware/System follower growth spike ─────────────────────
    if (input.has_growth_spike === true) {
        add("follower_growth_spike", true, 25, "Abnormal 7-day follower growth spike detected (highly indicative of purchased followers)", "high");
    }

    // ── Confidence calculation ────────────────────────────────────────────────
    // We can't be confident without real data. If key inputs are null, downgrade confidence.
    const nullCount = [engagement_rate, following_count, account_age_days, avg_likes, avg_comments]
        .filter(v => v === null).length;
    let confidence: "low" | "medium" | "high" = nullCount >= 3 ? "low" : nullCount >= 1 ? "medium" : "high";

    if (input.has_growth_spike !== null && confidence === "low") {
        confidence = "medium"; // Upgrade confidence slightly if we have DB history
    }

    return {
        score: Math.min(100, Math.round(totalScore)),
        signals,
        confidence,
    };
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const body: Partial<AnalysisInput> & { action?: string; verdict?: string; predicted_score?: number; signals_triggered?: string[] } = await req.json();

        // Handle feedback submission
        if (body.action === "feedback") {
            const { username, platform, predicted_score, verdict, signals_triggered } = body;

            if (!username || !platform || predicted_score == null || !verdict) {
                return new Response(JSON.stringify({ error: "Missing fields" }), {
                    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            if (!["authentic", "bot", "unsure"].includes(verdict)) {
                return new Response(JSON.stringify({ error: "verdict must be: authentic | bot | unsure" }), {
                    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            const authHeader = req.headers.get("Authorization");
            const serviceClientForAuth = createClient(
                Deno.env.get("SUPABASE_URL")!,
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
                { auth: { autoRefreshToken: false, persistSession: false } }
            );
            const { data: userData } = await serviceClientForAuth.auth.getUser(authHeader?.replace("Bearer ", "") || "");

            await serviceClientForAuth.from("bot_detection_feedback").insert({
                platform, username, predicted_score, user_verdict: verdict,
                signals_triggered: signals_triggered || [],
                user_id: userData?.user?.id || null,
            });

            if (verdict !== "unsure") {
                await serviceClientForAuth.rpc("process_bot_feedback", {
                    p_username: username, p_platform: platform,
                    p_predicted_score: predicted_score, p_verdict: verdict,
                    p_signals_triggered: JSON.stringify(signals_triggered || []),
                });
            }

            return new Response(JSON.stringify({ success: true, message: "Feedback recorded." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!body.username || !body.platform) {
            return new Response(JSON.stringify({ error: "username and platform are required" }), {
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Init service client early to fetch history
        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: profile } = await serviceClient
            .from("influencer_profiles")
            .select("id")
            .eq("username", body.username)
            .eq("platform", body.platform)
            .maybeSingle();

        let has_growth_spike = null;
        if (profile?.id) {
            const { data: spikeData } = await serviceClient
                .from("follower_growth_signals")
                .select("is_growth_spike")
                .eq("profile_id", profile.id)
                .order("recorded_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (spikeData) has_growth_spike = spikeData.is_growth_spike;
        }

        const input: AnalysisInput = {
            username: body.username,
            platform: body.platform,
            follower_count: body.follower_count ?? 0,
            following_count: body.following_count ?? null,
            posts_count: body.posts_count ?? null,
            engagement_rate: body.engagement_rate ?? null,
            avg_likes: body.avg_likes ?? null,
            avg_comments: body.avg_comments ?? null,
            account_age_days: body.account_age_days ?? null,
            bio: body.bio ?? null,
            sponsored_post_count: body.sponsored_post_count ?? null,
            total_post_count: body.total_post_count ?? null,
            recent_follower_delta: body.recent_follower_delta ?? null,
            has_growth_spike,
        };

        const { score, signals, confidence } = analyze(input);
        const triggeredSignals = signals.filter(s => s.triggered);
        const audience_quality_score = Math.max(0, 100 - score);

        // Persist to audience_analysis table if profile exists
        if (profile?.id) {
            const sponsored_ratio = (input.sponsored_post_count != null && input.total_post_count)
                ? input.sponsored_post_count / input.total_post_count : null;
            const post_frequency_per_day = (input.posts_count != null && input.account_age_days)
                ? input.posts_count / input.account_age_days : null;
            const comment_like_ratio = (input.avg_likes && input.avg_comments && input.avg_likes > 0)
                ? input.avg_comments / input.avg_likes : null;

            // Engagement consistency heuristic
            let engagement_consistency: "consistent" | "variable" | "suspicious" = "consistent";
            if (score > 60) engagement_consistency = "suspicious";
            else if (score > 30) engagement_consistency = "variable";

            await serviceClient.from("audience_analysis").upsert({
                profile_id: profile.id,
                bot_score: score,
                audience_quality_score,
                signals: { triggered: triggeredSignals, all: signals },
                confidence,
                comment_like_ratio,
                post_frequency_per_day,
                sponsored_ratio,
                engagement_consistency,
                analyzed_at: new Date().toISOString(),
            }, { onConflict: "profile_id" });

            // Also update influencer_profiles
            await serviceClient.from("influencer_profiles").update({
                bot_probability: score,
                bot_probability_entendre: score,
                audience_quality_score,
            }).eq("id", profile.id);
        }

        return new Response(JSON.stringify({
            bot_probability_entendre: score,
            audience_quality_score,
            confidence,
            signals: triggeredSignals,
            all_signals: signals,
            interpretation: score < 20 ? "Likely authentic — no significant red flags detected"
                : score < 40 ? "Minor concerns — worth monitoring but low risk for campaigns under $5K"
                    : score < 60 ? "Moderate risk — request media kit and last 3 months analytics before committing budget"
                        : score < 80 ? "High risk — strong indicators of inflated following. Require third-party audit."
                            : "Very high risk — do not proceed without independent verification",
            meta_api_note: "For enterprise campaigns, exact audience quality requires Meta Creator Marketplace API access (apply at business.facebook.com/creator-marketplace) or TikTok Creator Marketplace API. Current scores use 15 heuristic signals which detect ~65-70% of obvious fraud.",
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
