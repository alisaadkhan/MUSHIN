import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";
import { analyzeFullBotSignals, type BotAnalysisInput } from "../_shared/bot_signals.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const corsHeaders = {
    "Access-Control-Allow-Origin": APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // All paths — analysis and feedback — require a valid JWT.
    // Previously the main analysis path had no auth check, allowing unauthenticated
    // callers to write bot_probability scores to influencer_profiles (fixed 2026-03-11).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        const body: Partial<BotAnalysisInput> & { action?: string; verdict?: string; predicted_score?: number; signals_triggered?: string[] } = await req.json();

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

        const input: BotAnalysisInput = {
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

        const { score, signals, confidence } = analyzeFullBotSignals(input);
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
            interpretation: score < 20 ? "Likely authentic ΓÇö no significant red flags detected"
                : score < 40 ? "Minor concerns ΓÇö worth monitoring but low risk for campaigns under $5K"
                    : score < 60 ? "Moderate risk ΓÇö request media kit and last 3 months analytics before committing budget"
                        : score < 80 ? "High risk ΓÇö strong indicators of inflated following. Require third-party audit."
                            : "Very high risk ΓÇö do not proceed without independent verification",
            meta_api_note: "For enterprise campaigns, exact audience quality requires Meta Creator Marketplace API access (apply at business.facebook.com/creator-marketplace) or TikTok Creator Marketplace API. Current scores use 15 heuristic signals which detect ~65-70% of obvious fraud.",
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err: unknown) {
        return safeErrorResponse(err, "[detect-bot-entendre]", corsHeaders);
    }
});
