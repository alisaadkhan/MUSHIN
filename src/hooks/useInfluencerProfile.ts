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
    };
    overall_score: number | null;
    enriched_at: string | null;
    created_at: string;
    // From cache fallback
    isCached?: boolean;
    link?: string;
    snippet?: string;
    city_extracted?: string | null;
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

    const load = useCallback(async () => {
        if (!platform || !username) return;
        setLoading(true);
        setError(null);

        try {
            // 1. Try influencer_profiles (enriched)
            const { data: enriched } = await (supabase as any)
                .from("influencer_profiles")
                .select("*")
                .eq("platform", platform)
                .eq("username", username)
                .maybeSingle();

            if (enriched) {
                const secondaryNiches = Array.isArray(enriched.secondary_niches)
                    ? enriched.secondary_niches
                    : [];
                setProfile({ ...enriched, secondary_niches: secondaryNiches });
                setIsEnriched(true);

                // 2. Follower history
                const { data: history } = await (supabase as any)
                    .from("follower_history")
                    .select("*")
                    .eq("profile_id", enriched.id)
                    .order("recorded_at", { ascending: true });
                if (history) setFollowerHistory(history);

                // 3. Posts: count + content-type breakdown
                const { data: posts } = await (supabase as any)
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
                        primary_niche: null,
                        secondary_niches: [],
                        metrics: {},
                        overall_score: null,
                        enriched_at: null,
                        created_at: cached.created_at,
                        isCached: true,
                        link: d?.link,
                        snippet: d?.snippet,
                        city_extracted: cached.city_extracted,
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

    return { profile, followerHistory, contentPerformance, postsCount, isEnriched, loading, error, reload: load };
}
