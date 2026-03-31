-- =============================================================================
-- Migration: 20260331_search_recall_improvements.sql
-- Purpose  : Fix RC-04 — tag_match_influencers() city filter incorrectly
--            excluded creators with NULL city when a city filter was active.
--
--            Also extends the function to:
--            1. Accept an optional p_search_text parameter so the DB-first
--               path can do full-text search via tsvector in addition to tags.
--            2. Return creators whose city IS NULL when city filter is active
--               (benefit of the doubt — untagged city ≠ wrong city).
--            3. Lower the overall strictness of the tag+niche OR clause to
--               include creators who match via full-text search even if they
--               have no explicit tags.
--
-- Security : STABLE function, no data mutation. No RLS bypass risk.
-- Rollback : Previous version overwritten — re-deploy previous migration to roll
--            back (function is idempotent via CREATE OR REPLACE).
-- Idempotent: Yes — CREATE OR REPLACE FUNCTION.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tag_match_influencers(
    p_platform       TEXT,
    p_tags           TEXT[]    DEFAULT '{}',
    p_niche          TEXT      DEFAULT NULL,
    p_min_followers  BIGINT    DEFAULT 0,
    p_max_followers  BIGINT    DEFAULT 9999999999,
    p_min_er         FLOAT     DEFAULT 0,
    p_city           TEXT      DEFAULT NULL,
    p_limit          INT       DEFAULT 25,
    -- NEW: optional free-text search to augment tag matching
    p_search_text    TEXT      DEFAULT NULL
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
        -- Platform must always match
        p.platform = p_platform

        -- Follower range: creators with NULL followers pass through (unknown ≠ out-of-range)
        AND (p.follower_count IS NULL
             OR p.follower_count BETWEEN p_min_followers AND p_max_followers)

        -- Engagement rate: creators with NULL ER pass through
        AND (p.engagement_rate IS NULL OR p.engagement_rate >= p_min_er)

        -- RC-04 FIX: City filter — creators with NULL city are NOT excluded.
        -- A creator whose city is unset should be in the candidate pool; ranking
        -- will score city-matched creators higher. Without this fix, most stubs
        -- (which have city=NULL) were excluded when a city was selected.
        AND (
            p_city IS NULL
            OR p_city = 'All Pakistan'
            OR p.city IS NULL                                    -- <-- RC-04 fix: NULL city passes
            OR p.city ILIKE '%' || p_city || '%'
        )

        -- Content match: tag match, niche text match, OR full-text search
        AND (
            -- Tag match: creator has at least one of the requested tags
            (array_length(p_tags, 1) > 0 AND p.tags && p_tags)
            -- Niche match: creator's primary_niche contains the inferred niche
            OR (p_niche IS NOT NULL AND p.primary_niche ILIKE '%' || p_niche || '%')
            -- City match (as content signal, not filter): creator is from this city
            OR (p_city IS NOT NULL AND p_city <> 'All Pakistan'
                AND p.city IS NOT NULL AND p.city ILIKE '%' || p_city || '%')
            -- Full-text match via pre-computed tsvector (bio + username + full_name + niche)
            OR (p_search_text IS NOT NULL AND p.search_vector @@ plainto_tsquery('simple', p_search_text))
        )

    ORDER BY
        -- Fully enriched creators first (best data quality)
        (p.enrichment_status = 'success') DESC,
        -- City-exact match next (when city filter is active)
        (p_city IS NOT NULL AND p_city <> 'All Pakistan'
         AND p.city IS NOT NULL AND p.city ILIKE '%' || p_city || '%') DESC,
        -- Then by tag match count descending
        tag_match_count DESC,
        -- Then by followers descending as tiebreaker
        p.follower_count DESC NULLS LAST
    LIMIT p_limit;
$$;
