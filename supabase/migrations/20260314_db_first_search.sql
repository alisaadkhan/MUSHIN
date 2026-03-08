-- ─────────────────────────────────────────────────────────────────────────────
-- DB-First Search Indexes — 2026-03-14
--
-- Supports the "database-first" search path where Mushin checks its own
-- creator index before falling back to Serper. This dramatically reduces
-- external API calls and speeds up repeat searches.
--
-- Also adds composite tag GIN index for fast tag-intersection lookalike queries.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Full-text search index on influencer_profiles ─────────────────────────
-- Covers bio, full_name, username so that queries like "tech karachi" hit the DB.
-- We combine the columns into a tsvector using simple english stemming.

ALTER TABLE public.influencer_profiles
    ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('simple',
            coalesce(full_name, '') || ' ' ||
            coalesce(username, '') || ' ' ||
            coalesce(bio, '') || ' ' ||
            coalesce(primary_niche, '') || ' ' ||
            coalesce(city, '')
        )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_ip_search_vector
    ON public.influencer_profiles USING gin (search_vector);

-- ── 2. GIN index on tags[] for fast array-contains queries ───────────────────
CREATE INDEX IF NOT EXISTS idx_ip_tags_gin
    ON public.influencer_profiles USING gin (tags);

-- ── 3. Composite index for DB-first platform + enrichment_status lookups ─────
CREATE INDEX IF NOT EXISTS idx_ip_platform_status_followers
    ON public.influencer_profiles (platform, enrichment_status, follower_count DESC NULLS LAST);

-- ── 4. GIN index on influencers_cache.tags for tag filter lookups ─────────────
CREATE INDEX IF NOT EXISTS idx_ic_tags_gin
    ON public.influencers_cache USING gin (tags);

-- ── 5. creator_tags: add platform column if somehow missing from previous migration ─
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'creator_tags' AND column_name = 'platform'
    ) THEN
        ALTER TABLE public.creator_tags ADD COLUMN platform TEXT;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_creator_tags_platform_tag
    ON public.creator_tags (platform, tag, weight DESC);

-- ── 6. tag_match_influencers() — set-returning function for DB-first search ────
-- Returns profiles that contain any of the provided tags OR match the niche text.
-- Used as the primary DB lookup before resorting to Serper.

CREATE OR REPLACE FUNCTION public.tag_match_influencers(
    p_platform       TEXT,
    p_tags           TEXT[]    DEFAULT '{}',
    p_niche          TEXT      DEFAULT NULL,
    p_min_followers  BIGINT    DEFAULT 0,
    p_max_followers  BIGINT    DEFAULT 9999999999,
    p_min_er         FLOAT     DEFAULT 0,
    p_city           TEXT      DEFAULT NULL,
    p_limit          INT       DEFAULT 25
)
RETURNS TABLE (
    id               UUID,
    username         TEXT,
    platform         TEXT,
    full_name        TEXT,
    bio              TEXT,
    follower_count   BIGINT,
    engagement_rate  FLOAT,
    avatar_url       TEXT,
    primary_niche    TEXT,
    city             TEXT,
    tags             TEXT[],
    enrichment_status TEXT,
    last_enriched_at TIMESTAMPTZ,
    tag_match_count  INT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        p.id,
        p.username,
        p.platform,
        p.full_name,
        p.bio,
        p.follower_count,
        p.engagement_rate,
        p.avatar_url,
        p.primary_niche,
        p.city,
        p.tags,
        p.enrichment_status,
        p.last_enriched_at,
        -- Count how many of the requested tags this creator has
        CASE
            WHEN array_length(p_tags, 1) IS NULL OR array_length(p_tags, 1) = 0 THEN 0
            ELSE (
                SELECT COUNT(*)::INT
                FROM unnest(p_tags) t
                WHERE t = ANY(p.tags)
            )
        END AS tag_match_count
    FROM public.influencer_profiles p
    WHERE
        p.platform = p_platform
        AND (p.follower_count IS NULL OR p.follower_count BETWEEN p_min_followers AND p_max_followers)
        AND (p.engagement_rate IS NULL OR p.engagement_rate >= p_min_er)
        AND (
            -- Tag match
            (array_length(p_tags, 1) > 0 AND p.tags && p_tags)
            -- OR niche text match
            OR (p_niche IS NOT NULL AND p.primary_niche ILIKE '%' || p_niche || '%')
            -- OR city match
            OR (p_city IS NOT NULL AND p.city ILIKE '%' || p_city || '%')
        )
        AND (p_city IS NULL OR p.city ILIKE '%' || p_city || '%' OR p_city = 'All Pakistan')
    ORDER BY
        -- Fully enriched creators first
        (p.enrichment_status = 'success') DESC,
        -- Then by tag match count descending
        tag_match_count DESC,
        -- Then by followers descending as tiebreaker
        p.follower_count DESC NULLS LAST
    LIMIT p_limit;
$$;
