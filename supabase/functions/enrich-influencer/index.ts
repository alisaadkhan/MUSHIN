import { getServiceRoleKey } from "../_shared/privileged_gateway.ts";
import { performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis";
import { checkRateLimit, corsHeaders } from "../_shared/rate_limit.ts";
import { extractCityFromBio } from "../_shared/geo.ts";
import { computeQuickBotScore } from "../_shared/bot_signals.ts";
// ── Shared Utilities ───────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function extractLinkedHandles(bio: string, currentPlatform: string): Array<{ platform: string; username: string }> {
    const out: Array<{ platform: string; username: string }> = [];
    const ig = bio.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i) || (currentPlatform !== "instagram" ? bio.match(/\big:\s*@?([a-zA-Z0-9_.]{3,30})/i) : null);
    const tt = bio.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/i) || (currentPlatform !== "tiktok" ? bio.match(/\btiktok:\s*@?([a-zA-Z0-9_.]{3,30})/i) : null);
    const yt = bio.match(/youtube\.com\/@?([a-zA-Z0-9_.-]+)/i);
    if (ig?.[1] && currentPlatform !== "instagram") out.push({ platform: "instagram", username: ig[1] });
    if (tt?.[1] && currentPlatform !== "tiktok") out.push({ platform: "tiktok", username: tt[1] });
    if (yt?.[1] && currentPlatform !== "youtube") out.push({ platform: "youtube", username: yt[1] });
    return out;
}

// ΓöÇΓöÇ YouTube Data API v3 ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
async function fetchYouTubeData(username: string, apiKey: string) {
    const clean = username.replace(/^@/, "");
    const BASE = "https://www.googleapis.com/youtube/v3";

    // 1. Find channel ID
    let channelId: string | null = null;
    const handleRes = await fetch(`${BASE}/channels?part=id,snippet,statistics&forHandle=${encodeURIComponent(clean)}&key=${apiKey}`);
    if (handleRes.ok) {
        const d = await handleRes.json();
        channelId = d.items?.[0]?.id ?? null;
    }
    if (!channelId) {
        const searchRes = await fetch(`${BASE}/search?part=snippet&q=${encodeURIComponent(clean)}&type=channel&maxResults=3&key=${apiKey}`);
        if (searchRes.ok) {
            const sd = await searchRes.json();
            channelId = sd.items?.[0]?.snippet?.channelId ?? null;
        }
    }
    if (!channelId) throw new Error(`YouTube channel not found for username: ${clean}`);

    const chanRes = await fetch(`${BASE}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`);
    if (!chanRes.ok) throw new Error(`YouTube API failed: ${chanRes.status}`);
    const chanData = await chanRes.json();
    const channel = chanData.items?.[0];
    if (!channel) throw new Error("No channel data returned");

    const videosRes = await fetch(`${BASE}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=30&key=${apiKey}`);
    const videosData = videosRes.ok ? await videosRes.json() : { items: [] };
    const videoIds = (videosData.items || []).map((v: any) => v.id?.videoId).filter(Boolean);

    let posts: any[] = [];
    if (videoIds.length > 0) {
        const vStatsRes = await fetch(`${BASE}/videos?part=snippet,statistics&id=${videoIds.join(",")}&key=${apiKey}`);
        if (vStatsRes.ok) {
            const vData = await vStatsRes.json();
            posts = (vData.items || []).map((v: any) => ({
                platform_post_id: v.id,
                caption: v.snippet?.title || "",
                image_urls: v.snippet?.thumbnails?.high?.url ? [v.snippet.thumbnails.high.url] : [],
                posted_at: v.snippet?.publishedAt || new Date().toISOString(),
                likes: parseInt(v.statistics?.likeCount || "0", 10),
                comments: parseInt(v.statistics?.commentCount || "0", 10),
                is_sponsored: /#(ad|sponsored)\b/i.test(v.snippet?.title || ""),
            }));
        }
    }

    const subscribers = parseInt(channel.statistics?.subscriberCount || "0", 10);
    const avgLikes = posts.length ? Math.round(posts.reduce((s: number, p: any) => s + p.likes, 0) / posts.length) : null;
    const avgComments = posts.length ? Math.round(posts.reduce((s: number, p: any) => s + p.comments, 0) / posts.length) : null;
    const er = (subscribers > 0 && avgLikes !== null) ? parseFloat(((avgLikes / subscribers) * 100).toFixed(2)) : null;

    return {
        full_name: channel.snippet?.title || clean,
        bio: channel.snippet?.description?.substring(0, 500) || null,
        avatar_url: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.default?.url || null,
        follower_count: subscribers,
        following_count: null,
        posts_count: parseInt(channel.statistics?.videoCount || "0", 10),
        engagement_rate: er,
        avg_likes: avgLikes,
        avg_comments: avgComments,
        city: extractCityFromBio(channel.snippet?.description || ""),
        is_private: false,
        channel_id: channelId,
        posts,
    };
}

// ΓöÇΓöÇ Apify Integration (Instagram / TikTok) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
function apifyActorFor(platform: string): { actorId: string; buildInput: (u: string) => unknown } {
    const clean = (u: string) => u.replace(/^@/, "");
    if (platform === "instagram") return {
        actorId: "apify~instagram-profile-scraper",
        buildInput: (u) => ({ usernames: [clean(u)], resultsLimit: 30 }),
    };
    if (platform === "tiktok") return {
        actorId: "clockworks~tiktok-profile-scraper",
        buildInput: (u) => ({
            profiles: [`https://www.tiktok.com/@${clean(u)}`],
            shouldDownloadVideos: false,
            shouldDownloadCovers: false,
        }),
    };
    throw new Error(`Platform ${platform} not supported by Apify`);
}

function mapInstagram(raw: any) {
    const posts = (raw.latestPosts || []).slice(0, 30).map((p: any) => ({
        platform_post_id: p.id || p.shortCode || `ig_${Date.now()}_${Math.random()}`,
        caption: p.caption || "",
        image_urls: p.images || (p.displayUrl ? [p.displayUrl] : []),
        posted_at: (() => {
            if (!p.timestamp) return new Date().toISOString();
            // Apify can return Unix epoch (number) or ISO string
            const ts = typeof p.timestamp === "number" ? new Date(p.timestamp * 1000) : new Date(p.timestamp);
            return isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();
        })(),
        likes: p.likesCount ?? 0,
        comments: p.commentsCount ?? 0,
        is_sponsored: /#(ad|sponsored|paid|collab)\b/i.test(p.caption || ""),
    }));
    const avgLikes = posts.length ? posts.reduce((s: number, p: any) => s + p.likes, 0) / posts.length : null;
    const avgComments = posts.length ? posts.reduce((s: number, p: any) => s + p.comments, 0) / posts.length : null;
    const er = (raw.followersCount > 0 && avgLikes !== null)
        ? parseFloat(((avgLikes / raw.followersCount) * 100).toFixed(2))
        : null;
    return {
        full_name: raw.fullName || raw.username, bio: raw.biography,
        avatar_url: raw.profilePicUrlHD || raw.profilePicUrl,
        follower_count: raw.followersCount ?? null,
        following_count: raw.followsCount ?? null,
        posts_count: raw.postsCount ?? posts.length,
        engagement_rate: er,
        avg_likes: avgLikes ? Math.round(avgLikes) : null,
        avg_comments: avgComments ? Math.round(avgComments) : null,
        city: extractCityFromBio(raw.biography),
        is_private: raw.isPrivate ?? false,
        posts,
    };
}

function mapTikTok(raw: any) {
    // clockworks~tiktok-profile-scraper returns either:
    // Format A: { authorMeta: {...}, posts: [...] }  (profile + posts in one object)
    // Format B: array of video objects each with authorMeta
    // We handle both.
    const meta = raw.authorMeta || raw[0]?.authorMeta || {};

    // Extract posts: raw.posts array, or the items array is already posts if Format B
    const rawPosts: any[] = Array.isArray(raw.posts) && raw.posts.length > 0
        ? raw.posts
        : Array.isArray(raw) ? raw.slice(0, 30) : [];

    const posts = rawPosts.slice(0, 30).map((p: any) => ({
        platform_post_id: p.id || p.videoId || `tt_${Date.now()}_${Math.random()}`,
        caption: p.text || p.description || "",
        image_urls: p.videoMeta?.coverUrl ? [p.videoMeta.coverUrl] : [],
        posted_at: (() => {
            if (!p.createTime && !p.createTimeISO) return new Date().toISOString();
            if (p.createTimeISO) return new Date(p.createTimeISO).toISOString();
            // createTime is Unix timestamp in seconds
            const ts = new Date((p.createTime as number) * 1000);
            return isNaN(ts.getTime()) ? new Date().toISOString() : ts.toISOString();
        })(),
        likes: p.diggCount ?? p.stats?.diggCount ?? 0,
        comments: p.commentCount ?? p.stats?.commentCount ?? 0,
        views: p.playCount ?? p.stats?.playCount ?? null,
        is_sponsored: /#(ad|sponsored|paid|collab|partnership)\b/i.test(p.text || ""),
    }));

    const followerCount: number = meta.fans ?? meta.followerCount ?? 0;

    // Compute real engagement from post data
    const avgLikes = posts.length
        ? posts.reduce((s, p) => s + (p.likes || 0), 0) / posts.length
        : null;
    const avgComments = posts.length
        ? posts.reduce((s, p) => s + (p.comments || 0), 0) / posts.length
        : null;
    const avgViews = posts.filter(p => p.views != null).length > 0
        ? posts.filter(p => p.views != null).reduce((s, p) => s + p.views, 0) / posts.filter(p => p.views != null).length
        : null;

    // TikTok engagement: use likes as primary signal if follower count known
    // If views available, also compute view-based ER (more accurate for TikTok)
    let engagementRate: number | null = null;
    if (followerCount > 0 && avgLikes !== null) {
        engagementRate = parseFloat(((avgLikes / followerCount) * 100).toFixed(2));
    }

    // Validate: cap at 100 (data quality guard)
    if (engagementRate !== null && (engagementRate > 100 || engagementRate < 0)) {
        engagementRate = null;
    }

    return {
        full_name: meta.name || meta.nickName || meta.uniqueId || null,
        bio: meta.signature || null,
        avatar_url: meta.avatar || meta.avatarLarger || null,
        follower_count: followerCount || null,
        following_count: meta.following ?? null,
        posts_count: meta.video ?? rawPosts.length,
        engagement_rate: engagementRate,
        avg_likes: avgLikes !== null ? Math.round(avgLikes) : null,
        avg_comments: avgComments !== null ? Math.round(avgComments) : null,
        avg_views: avgViews !== null ? Math.round(avgViews) : null,
        city: extractCityFromBio(meta.signature || ""),
        is_private: meta.privateAccount ?? false,
        posts,
    };
}

// Robust fetch with retry
async function fetchApifyDataWithRetries(platform: string, username: string, apiKey: string) {
    const actor = apifyActorFor(platform);
    let attempts = 0;
    let lastError: Error | null = null;
    const maxAttempts = 3;
    const baseDelayMs = 2000;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            // 1. Start run
            const input = actor.buildInput(username);
            console.log(`[enrich] Calling Apify ${actor.actorId} for ${platform}/${username} (Attempt ${attempts})`);
            const startRes = await fetch(`https://api.apify.com/v2/acts/${actor.actorId}/runs`, {
                method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }, body: JSON.stringify(input)
            });
            if (!startRes.ok) throw new Error(`Apify start failed: ${startRes.status} ${await startRes.text()}`);

            const { data: run } = await startRes.json();
            const runId = run.id;

            // 2. Poll up to 120s
            let succeeded = false;
            for (let i = 0; i < 24; i++) {
                await sleep(5000);
                const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
                    headers: { "Authorization": `Bearer ${apiKey}` },
                });
                const { data: s } = await statusRes.json();
                if (s.status === "SUCCEEDED") { succeeded = true; break; }
                if (["FAILED", "ABORTED", "TIMED-OUT"].includes(s.status)) {
                    throw new Error(`Apify run ended with status: ${s.status}`);
                }
            }
            if (!succeeded) throw new Error("Apify polling timed out after 120s");

            // 3. Fetch items
            const itemsRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
                headers: { "Authorization": `Bearer ${apiKey}` },
            });
            if (!itemsRes.ok) throw new Error("Failed to fetch Apify dataset items");
            const items = await itemsRes.json();

            if (!Array.isArray(items) || items.length === 0) {
                throw new Error("Apify returned no data (possibly private, banned, or not found)");
            }

            const raw = items[0];
            if (platform === "instagram") return mapInstagram(raw);
            if (platform === "tiktok") return mapTikTok(raw);
            throw new Error("Unknown platform mapper");

        } catch (err: any) {
            lastError = err;
            console.error(`[enrich] Apify failed on attempt ${attempts}:`, err.message);
            if (err.message.includes("Private") || err.message.includes("not found")) {
                // Break early for non-retryable errors
                break;
            }
            if (attempts < maxAttempts) {
                await sleep(baseDelayMs * Math.pow(2, attempts - 1));
            }
        }
    }

    throw lastError || new Error("Failed to extract data via Apify after retries");
}

let redis: Redis | null = null;
if (Deno.env.get("UPSTASH_REDIS_REST_URL") && Deno.env.get("UPSTASH_REDIS_REST_TOKEN")) {
    redis = new Redis({
        url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
        token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
    });
}

// ΓöÇΓöÇ Main handler ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// ΓöÇΓöÇ Main handler ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const t0 = performance.now();

    try {
        const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
        const { allowed } = await checkRateLimit(ip, 'enrich');
        if (!allowed) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded' }),
                { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const token = authHeader.replace("Bearer ", "");
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const serviceClient = await performPrivilegedWrite({
        authHeader: req.headers.get("Authorization"),
        action: "gateway:privileged-client-bootstrap",
        execute: async (_ctx, client) => client,
    });

        const { data: workspaceId } = await supabase.rpc("get_user_workspace_id");
        if (!workspaceId) return new Response(JSON.stringify({ error: "No workspace" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        const { data: workspace } = await serviceClient
            .from("workspaces")
            .select("enrichment_credits_remaining, monthly_api_budget_usd, current_month_spend_usd, enrichment_locked")
            .eq("id", workspaceId)
            .single();

        // Check budget cap before hitting paid APIs
        if (workspace?.enrichment_locked) {
            return new Response(JSON.stringify({
                error: "Monthly API budget reached. Enrichment is paused until next billing cycle or admin increases budget.",
                code: "BUDGET_LOCKED"
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Credit decrement will happen atomically at the end

        const { username, platform, bio, primary_niche, force_refresh } = await req.json();
        if (!username || !platform) return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        // Ensure we don't accidentally enrich an invalid platform
        if (!["instagram", "tiktok", "youtube"].includes(platform)) {
            return new Response(JSON.stringify({ error: `Unsupported platform: ${platform}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { data: existing } = await serviceClient.from("influencer_profiles").select("id, enriched_at, enrichment_status").eq("platform", platform).eq("username", username).maybeSingle();
        if (existing?.enriched_at && !force_refresh) {
            const daysSince = (Date.now() - new Date(existing.enriched_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) {
                return new Response(
                    JSON.stringify({
                        error: 'Profile was recently enriched. Please wait 7 days before re-enriching.',
                        enriched_at: existing.enriched_at,
                        cooldown_remaining_days: Math.ceil(7 - daysSince)
                    }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }
        if (existing?.enrichment_status === "processing") return new Response(JSON.stringify({ error: "processing", code: "PROCESSING" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

        // Lock profile state to 'processing'
        await serviceClient.from("influencer_profiles").upsert({ platform, username, enrichment_status: "processing", enrichment_error: null }, { onConflict: "platform,username" });

        // ΓöÇΓöÇ Execute Data Fetching ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        let enriched: any = null;
        let dataSource = "apify";
        const ytKey = Deno.env.get("YOUTUBE_API_KEY");
        const apifyKey = Deno.env.get("APIFY_API_KEY");

        try {
            if (platform === "youtube") {
                if (!ytKey) {
                    console.warn("[enrich] YOUTUBE_API_KEY not configured — YouTube profile enrichment is unavailable");
                    throw new Error("YOUTUBE_API_KEY is not configured.");
                }
                enriched = await fetchYouTubeData(username, ytKey);
                dataSource = "youtube_api";
            } else {
                if (!apifyKey) {
                    console.warn("[enrich] APIFY_API_KEY not configured — Instagram/TikTok enrichment is unavailable");
                    return new Response(JSON.stringify({ error: "Enrichment is temporarily unavailable. Please contact support." }), {
                        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                }
                enriched = await fetchApifyDataWithRetries(platform, username, apifyKey);
            }
        } catch (e: any) {
            const errorMsg = e.message || "Unknown error during data fetching";
            console.error(`[enrich] Primary fetch failed for ${platform}/${username}:`, errorMsg);

            // ΓöÇΓöÇ Fallback: return partial data from Serper cache ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
            // Don't charge credits. Return what we know from the search snippet.
            // This is clearly labeled as partial/estimated so the user isn't misled.
            const { data: cachedProfile } = await serviceClient
                .from("influencer_profiles")
                .select("follower_count, bio, city, primary_niche, avatar_url, full_name")
                .eq("platform", platform)
                .eq("username", username)
                .maybeSingle();

            if (cachedProfile?.follower_count || cachedProfile?.bio) {
                // Mark as partial ΓÇö not full enrichment
                await serviceClient.from("influencer_profiles").update({
                    enrichment_status: "partial",
                    enrichment_error: `Primary data source unavailable: ${errorMsg}. Showing cached data only.`,
                }).eq("platform", platform).eq("username", username);

                return new Response(JSON.stringify({
                    success: false,
                    partial: true,
                    warning: "Full enrichment temporarily unavailable. Showing previously cached data. Credits were not deducted. Please try again in a few minutes.",
                    profile: cachedProfile,
                    data_source: "cache_fallback",
                    credits_remaining: workspace?.enrichment_credits_remaining ?? 0,
                }), {
                    status: 206, // 206 Partial Content ΓÇö semantically correct
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // No fallback data available ΓÇö unlock and fail cleanly
            await serviceClient.from("influencer_profiles").update({
                enrichment_status: "failed",
                enrichment_error: errorMsg
            }).eq("platform", platform).eq("username", username);

            // Phase 6: Log hard failures to enrichment_failures table
            await serviceClient.from("enrichment_failures").insert({
                platform,
                username,
                error_message: errorMsg,
                error_type: "apify_fetch_error",
                workspace_id: workspaceId
            }).catch(e => console.error("Failed to log enrichment failure", e.message));

            return new Response(JSON.stringify({
                error: "Enrichment temporarily unavailable. Credits were not deducted. Please try again in a few minutes.",
                technical_detail: errorMsg,
            }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (!enriched) {
            const errMsg = "Enrichment yielded no data";
            await serviceClient.from("influencer_profiles").update({ enrichment_status: "failed", enrichment_error: errMsg }).eq("platform", platform).eq("username", username);
            return new Response(JSON.stringify({ error: errMsg, code: "NO_DATA" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // ΓöÇΓöÇ Apply Data ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        const resolvedNiche = primary_niche || "Lifestyle";
        const city = enriched.city || extractCityFromBio(bio || "");

        const botP = computeQuickBotScore({
            followers: enriched.follower_count ?? 0, following: enriched.following_count ?? 0,
            postsCount: enriched.posts_count ?? (enriched.posts?.length ?? 0),
            engagementRate: enriched.engagement_rate ?? 3, bioLength: (enriched.bio || "").length,
        });
        const aq = Math.max(0, 100 - botP);
        const fraudScore = botP >= 60 ? 3 : botP >= 30 ? 2 : 1;

        let profile: any = null;
        try {
            const { data: p, error: pErr } = await serviceClient.from("influencer_profiles").upsert({
                platform, username, full_name: enriched.full_name || username, bio: enriched.bio,
                avatar_url: enriched.avatar_url, follower_count: enriched.follower_count, following_count: enriched.following_count,
                posts_count: enriched.posts_count, engagement_rate: enriched.engagement_rate, primary_niche: resolvedNiche,
                metrics: { followers: enriched.follower_count, engagement_rate: enriched.engagement_rate, avg_likes: enriched.avg_likes, avg_comments: enriched.avg_comments, city: city },
                fraud_score: fraudScore, audience_quality_score: aq, bot_probability: botP, data_source: dataSource, city: city,
                enrichment_status: "success", enrichment_error: null, enriched_at: new Date().toISOString(), last_enriched_at: new Date().toISOString()
            }, { onConflict: "platform,username", ignoreDuplicates: false }).select().single();
            if (pErr) throw pErr;
            profile = p;

            if (enriched.posts?.length) {
                const rows = enriched.posts.map((po: any) => ({
                    profile_id: profile.id, ...po, platform_post_id: po.platform_post_id || `${platform}_${username}_${Date.now()}_${Math.random()}`
                }));
                await serviceClient.from("influencer_posts").upsert(rows, { onConflict: "profile_id,platform_post_id", ignoreDuplicates: true });
            }

            if (enriched.follower_count) {
                await serviceClient.from("follower_history").insert({ profile_id: profile.id, follower_count: enriched.follower_count });
            }

            for (const link of extractLinkedHandles(enriched.bio || "", platform)) {
                await serviceClient.from("linked_accounts").upsert({
                    profile_id_a: profile.id, platform_a: platform, username_a: username, platform_b: link.platform, username_b: link.username,
                    confidence_score: 0.9, matched_by: "bio_link",
                }, { onConflict: "profile_id_a,platform_b,username_b" }).catch(() => { });
            }
        } catch (writeErr: any) {
            console.error(`[enrich] DB write failed for ${platform}/${username}:`, writeErr.message);
            await serviceClient.from("influencer_profiles").update({ enrichment_status: "failed", enrichment_error: writeErr.message }).eq("platform", platform).eq("username", username);
            return new Response(JSON.stringify({ error: "A database error occurred while saving profile data. Credits were not deducted.", code: "DB_ERROR" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Success -> Deduct Credits Atomically
        try {
            await serviceClient.rpc('consume_enrichment_credit', { ws_id: workspaceId });
        } catch (error: any) {
            if (error.code === 'P0001') {
                return new Response(
                    JSON.stringify({ error: 'Insufficient credits', code: "CREDITS_EXHAUSTED" }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            throw error;
        }

        await serviceClient.from("credits_usage").insert({ workspace_id: workspaceId, action_type: "enrichment", amount: 1 });

        // Log API cost for financial tracking
        // Apify approximate costs: Instagram ~$0.005/profile, TikTok ~$0.005/profile
        // YouTube Data API: ~$0.001/profile (free tier mostly)
        const approxCostUsd = platform === "youtube" ? 0.001 : 0.005;
        await serviceClient.rpc("record_api_cost", {
            ws_id: workspaceId,
            p_api_name: platform === "youtube" ? "youtube" : "apify",
            p_action: "enrich",
            p_cost_usd: approxCostUsd,
            p_units: 1,
        }).catch((e: any) => console.warn("[enrich] Cost logging failed:", e.message));

        // Fire-and-forget: trigger AI tag extraction pipeline for this profile
        if (profile?.id) {
            const tagUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/extract-creator-tags`;
            fetch(tagUrl, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${getServiceRoleKey()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ profile_id: profile.id }),
            }).catch((e: any) => console.warn("[enrich] tag extraction fire-and-forget failed:", e.message));
        }

        // Invalidate Search Cache for this Profile
        if (redis) {
            try {
                const cleanUsername = username.replace("@", "");
                const tagsKey = `tag:${cleanUsername}:${platform}`;
                const keysToInvalidate = await redis.smembers(tagsKey);
                if (keysToInvalidate.length > 0) {
                    await redis.del(...keysToInvalidate, tagsKey);
                    console.log(`Invalidated ${keysToInvalidate.length} cache keys for ${platform}:${cleanUsername}`);
                }
            } catch (cacheErr) {
                console.warn("Failed to invalidate cache", cacheErr);
            }
        }

        const t1 = performance.now();
        if (user) {
            await serviceClient.from("admin_audit_log").insert({
                action: "enrich",
                admin_user_id: user.id,
                details: {
                    username,
                    platform,
                    latency_ms: Math.round(t1 - t0)
                }
            });
        }

        const isStale = profile?.last_enriched_at ? (Date.now() - new Date(profile.last_enriched_at).getTime()) / (1000 * 60 * 60 * 24) > (profile.enrichment_ttl_days ?? 30) : false;

        return new Response(JSON.stringify({ success: true, profile, data_source: dataSource, is_stale: isStale, credits_remaining: (workspace?.enrichment_credits_remaining || 1) - 1 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err: any) {
        // HIGH-04: Log internally, return generic safe error to client
        console.error(`[enrich] Unhandled error for ${req.url}:`, err.message ?? err);
        return new Response(JSON.stringify({ error: "Internal server error", code: "INTERNAL_ERROR" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
