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
        if (!platform || !username) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);

        try {
            // Single query — eliminates the duplicate round-trip that was fetching
            // enriched_at separately before immediately re-querying the same table.
            const { data: enriched } = await supabase
                .from("influencer_profiles")
                .select("*")
                .eq("platform", platform)
                .eq("username", username)
                .maybeSingle();

            const daysSinceThisEnrichment = enriched?.enriched_at
                ? (Date.now() - new Date(enriched.enriched_at).getTime()) / (1000 * 60 * 60 * 24)
                : null;
            setDaysSinceEnrichment(daysSinceThisEnrichment);

            if (enriched) {
                const secondaryNiches = Array.isArray(enriched.secondary_niches)
                    ? enriched.secondary_niches
                    : [];
                const fullyEnriched = enriched.enrichment_status === "success";
                setIsEnriched(fullyEnriched);

                // For stubs (searched but not yet enriched), merge influencers_cache data
                // so the profile page can show follower count, snippet bio, and avatar
                let profileData: any = { ...enriched, secondary_niches: secondaryNiches };
                if (!fullyEnriched) {
                    // Cache stores usernames WITH @ prefix; URL params arrive without @ — try both
                    const { data: cached } = await supabase
                        .from("influencers_cache")
                        .select("*")
                        .eq("platform", platform)
                        .in("username", [username, `@${username}`])
                        .maybeSingle();
                    if (cached) {
                        const d = cached.data as any;
                        profileData = {
                            ...profileData,
                            follower_count: enriched.follower_count ?? d?.followers ?? null,
                            full_name: enriched.full_name ?? d?.title ?? username,
                            bio: enriched.bio ?? d?.snippet ?? null,
                            avatar_url: enriched.avatar_url ?? d?.imageUrl ?? null,
                            city: enriched.city ?? (cached as any).city_extracted ?? null,
                            primary_niche: enriched.primary_niche ?? d?.niche ?? null,
                            metrics: {
                                ...(enriched.metrics as object || {}),
                                followers: enriched.follower_count ?? d?.followers ?? null,
                                engagement_rate: enriched.engagement_rate ?? d?.engagement_rate ?? null,
                                following_count: (enriched.metrics as any)?.following_count ?? enriched.following_count ?? d?.following_count ?? null,
                                posts_count: (enriched.metrics as any)?.posts_count ?? d?.posts_count ?? null,
                            },
                        };
                    }
                }
                setProfile(profileData as unknown as InfluencerProfile);

                // 2+3+4. Fetch follower history, posts, and audience analysis in parallel
                const [historyRes, postsRes, analysisRes] = await Promise.all([
                    supabase.from("follower_history").select("*").eq("profile_id", enriched.id).order("recorded_at", { ascending: true }),
                    supabase.from("influencer_posts").select("id, caption, is_sponsored").eq("profile_id", enriched.id),
                    supabase.from("audience_analysis" as any).select("signals").eq("profile_id", enriched.id).maybeSingle(),
                ]);

                if (historyRes.error) console.warn("[profile] follower_history error:", historyRes.error.message);
                if (postsRes.error) console.warn("[profile] influencer_posts error:", postsRes.error.message);
                if (analysisRes.error) console.warn("[profile] audience_analysis error:", analysisRes.error.message);

                if (historyRes.data) setFollowerHistory(historyRes.data);

                const posts = postsRes.data;
                // Use the authoritative posts_count from the profile row when available.
                // For YouTube this is channel.statistics.videoCount (real total),
                // not just the ~30 videos we inserted into influencer_posts.
                const dbPostsCount = (enriched as any).posts_count ?? null;
                setPostsCount(dbPostsCount ?? (posts && posts.length > 0 ? posts.length : null));

                if (posts && posts.length > 0) {
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
                    setContentPerformance([]);
                }

                // Merge audience analysis into profile in a single state update
                setProfile(prev => {
                    if (!prev) return prev;
                    const updates: Partial<InfluencerProfile> = {};
                    if (analysisRes.data) updates.audience_analysis = analysisRes.data;
                    if (enriched.bot_signals && fullyEnriched) updates.bot_signals = enriched.bot_signals as any;
                    return Object.keys(updates).length > 0 ? { ...prev, ...updates } as InfluencerProfile : prev;
                });
            } else {
                // Fallback to influencers_cache
                // Cache stores usernames WITH @ prefix; URL params arrive without @ — try both
                const { data: cached } = await supabase
                    .from("influencers_cache")
                    .select("*")
                    .eq("platform", platform)
                    .in("username", [username, `@${username}`])
                    .maybeSingle();

                if (cached) {
                    const d = cached.data as any;
                    // followers is stored as `followers` by search-influencers upsert
                    const cachedFollowers: number | null = d?.followers ?? null;
                    setProfile({
                        id: cached.id,
                        platform: cached.platform,
                        username: cached.username,
                        full_name: d?.title || username,
                        bio: d?.snippet || null,
                        primary_niche: d?.niche || null,
                        secondary_niches: [],
                        metrics: {
                            followers: cachedFollowers ?? undefined,
                            engagement_rate: d?.engagement_rate ?? undefined,
                        },
                        overall_score: null,
                        enriched_at: null,
                        created_at: cached.created_at,
                        isCached: true,
                        follower_count: cachedFollowers,
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
