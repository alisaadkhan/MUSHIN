import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InfluencerProfile {
    id: string;
    platform: string;
    username: string;
    full_name: string | null;
    bio: string | null;
    primary_niche: string | null;
    secondary_niches: string[];
    metrics: {
        followers?: number;
        engagement_rate?: number;
        avg_likes?: number;
        avg_comments?: number;
        city?: string;
        subscriber_count?: number;
        following_count?: number;
        posts_count?: number;
    };
    overall_score: number | null;
    enriched_at: string | null;
    created_at: string;
    avatar_url?: string | null;
    follower_count?: number | null;
    following_count?: number | null;
    engagement_rate?: number | null;
    audience_quality_score?: number | null;
    bot_probability?: number | null;
    bot_probability_entendre?: number | null;
    bot_signals?: Array<{
        name: string;
        triggered: boolean;
        weight: number;
        detail: string;
        risk: "low" | "medium" | "high";
    }>;
    bot_signals_triggered?: number;
    bot_total_signals_checked?: number;
    bot_confidence_tier?: string;
    bot_interpretation?: string;
    data_source?: string | null;
    enrichment_status?: string | null;
    enrichment_error?: string | null;
    city?: string | null;
    niche?: string | null;
    city_extracted?: string | null;
    audience_analysis?: { signals?: { triggered?: any[], all?: any[] } };
    // From cache fallback
    isCached?: boolean;
    imageUrl?: string | null;
    link?: string;
    snippet?: string;
}

export interface FollowerHistoryPoint {
    id: string;
    profile_id: string;
    recorded_at: string;
    follower_count: number;
}

export interface PostTypeSummary {
    type: string;
    posts: number;
    sponsored: number;
}

function classifyPostType(caption: string): string {
    const c = caption.toLowerCase();
    if (c.includes("#live") || c.includes("live:")) return "Live";
    if (c.includes("#reel") || c.includes("reel")) return "Reel";
    if (c.includes("#story") || c.includes("story")) return "Story";
    return "Post";
}

export function useInfluencerProfile(platform: string | undefined, username: string | undefined) {
    const [profile, setProfile] = useState<InfluencerProfile | null>(null);
    const [followerHistory, setFollowerHistory] = useState<FollowerHistoryPoint[]>([]);
    const [contentPerformance, setContentPerformance] = useState<PostTypeSummary[]>([]);
    const [postsCount, setPostsCount] = useState<number | null>(null);
    const [isEnriched, setIsEnriched] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [daysSinceEnrichment, setDaysSinceEnrichment] = useState<number | null>(null);

    const load = useCallback(async () => {
        if (!platform || !username) return;
        setLoading(true);
        setError(null);

        try {
            // Direct query for freshness (SEPARATE from cache fetch)
            const { data: freshnessData } = await supabase
                .from('influencer_profiles')
                .select('enriched_at, enrichment_status, enrichment_error')
                .eq('username', username)
                .eq('platform', platform)
                .single();

            const daysSinceThisEnrichment = freshnessData?.enriched_at
                ? (Date.now() - new Date(freshnessData.enriched_at).getTime()) / (1000 * 60 * 60 * 24)
                : null;
            setDaysSinceEnrichment(daysSinceThisEnrichment);

            // 1. Try influencer_profiles (enriched)
            const { data: enriched } = await supabase
                .from("influencer_profiles")
                .select("*")
                .eq("platform", platform)
                .eq("username", username)
                .maybeSingle();

            if (enriched) {
                const secondaryNiches = Array.isArray(enriched.secondary_niches)
                    ? enriched.secondary_niches
                    : [];
                setProfile({ ...enriched, secondary_niches: secondaryNiches } as unknown as InfluencerProfile);
                setIsEnriched(true);

                // 2. Follower history
                const { data: history } = await supabase
                    .from("follower_history")
                    .select("*")
                    .eq("profile_id", enriched.id)
                    .order("recorded_at", { ascending: true });
                if (history) setFollowerHistory(history);

                // 3. Posts: count + content-type breakdown
                const { data: posts } = await supabase
                    .from("influencer_posts")
                    .select("id, caption, is_sponsored")
                    .eq("profile_id", enriched.id);

                if (posts && posts.length > 0) {
                    setPostsCount(posts.length);
                    // Aggregate by inferred post type from caption
                    const typeMap: Record<string, { posts: number; sponsored: number }> = {};
                    for (const post of posts) {
                        const t = classifyPostType(post.caption || "");
                        if (!typeMap[t]) typeMap[t] = { posts: 0, sponsored: 0 };
                        typeMap[t].posts += 1;
                        if (post.is_sponsored) typeMap[t].sponsored += 1;
                    }
                    // Ensure standard order: Reel, Post, Story, Live
                    const order = ["Reel", "Post", "Story", "Live"];
                    const sorted = order
                        .filter((k) => typeMap[k])
                        .map((k) => ({ type: k, ...typeMap[k] }));
                    // Append any unexpected types
                    for (const [t, v] of Object.entries(typeMap)) {
                        if (!order.includes(t)) sorted.push({ type: t, ...v });
                    }
                    setContentPerformance(sorted);
                } else {
                    setPostsCount(0);
                    setContentPerformance([]);
                }

                // 4. Audience Analysis (Phase 6 Bot Signals)
                const { data: analysis } = await supabase
                    .from("audience_analysis" as any)
                    .select("signals")
                    .eq("profile_id", enriched.id)
                    .maybeSingle();

                if (analysis) {
                    setProfile(prev => prev ? { ...prev, audience_analysis: analysis } as InfluencerProfile : null);
                }

                // 5. Call detect-bot-entendre to get detailed signals (not stored in DB, fetched live)
                try {
                    const botResult = await supabase.functions.invoke("detect-bot-entendre", {
                        body: {
                            username: enriched.username,
                            platform: enriched.platform,
                            follower_count: enriched.follower_count,
                            following_count: enriched.following_count,
                            posts_count: enriched.posts_count,
                            engagement_rate: enriched.engagement_rate,
                            bio: enriched.bio,
                        },
                    });

                    if (botResult.data) {
                        setProfile(prev => prev ? {
                            ...prev,
                            bot_probability_entendre: botResult.data.bot_probability_entendre != null
                                ? botResult.data.bot_probability_entendre / 100
                                : prev.bot_probability_entendre,
                            bot_signals: botResult.data.signals || [],
                            bot_signals_triggered: botResult.data.signals_triggered,
                            bot_total_signals_checked: botResult.data.total_signals_checked,
                            bot_confidence_tier: botResult.data.confidence_tier,
                            bot_interpretation: botResult.data.interpretation,
                        } : prev);
                    }
                } catch (botErr) {
                    // Non-critical: bot signals are supplementary, don't block render
                    console.warn("Bot signal fetch failed:", botErr);
                }
            } else {
                // Fallback to influencers_cache
                const { data: cached } = await supabase
                    .from("influencers_cache")
                    .select("*")
                    .eq("platform", platform)
                    .eq("username", username)
                    .maybeSingle();

                if (cached) {
                    const d = cached.data as any;
                    setProfile({
                        id: cached.id,
                        platform: cached.platform,
                        username: cached.username,
                        full_name: d?.title || username,
                        bio: d?.snippet || null,
                        primary_niche: d?.niche || null,
                        secondary_niches: [],
                        metrics: {},
                        overall_score: null,
                        enriched_at: null,
                        created_at: cached.created_at,
                        isCached: true,
                        link: d?.link,
                        snippet: d?.snippet,
                        city_extracted: cached.city_extracted,
                        // Expose cached image + engagement for profile page
                        avatar_url: d?.imageUrl || null,
                        engagement_rate: d?.engagement_rate ?? null,
                    });
                    setIsEnriched(false);
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to load profile");
        } finally {
            setLoading(false);
        }
    }, [platform, username]);

    useEffect(() => {
        load();
    }, [load]);

    const isStale = daysSinceEnrichment !== null && daysSinceEnrichment > 30;

    return { profile, followerHistory, contentPerformance, postsCount, isEnriched, loading, error, reload: load, daysSinceEnrichment, isStale };
}
