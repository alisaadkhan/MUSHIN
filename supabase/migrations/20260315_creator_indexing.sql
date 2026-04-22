-- ─────────────────────────────────────────────────────────────────────────────
-- Creator Indexing — Phase 5
-- Applied: 2026-03-15
-- Adds: last_seen_at timestamps to influencers_cache and influencer_profiles
--       so the system can track when creators were last discovered/indexed,
--       enabling staleness detection and cache invalidation.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add last_seen_at to influencers_cache
--    Updated every time a creator appears in Serper search results.
ALTER TABLE public.influencers_cache
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
-- 2. Add last_seen_at to influencer_profiles
--    Updated when a profile is created as a stub or re-discovered.
ALTER TABLE public.influencer_profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
-- 3. Indexes for staleness queries (find creators not seen in > 30 days)
CREATE INDEX IF NOT EXISTS idx_ic_last_seen_at
  ON public.influencers_cache (last_seen_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ip_last_seen_at
  ON public.influencer_profiles (last_seen_at DESC NULLS LAST);
-- 4. Composite index: platform + last_seen_at for platform-scoped staleness
CREATE INDEX IF NOT EXISTS idx_ic_platform_last_seen
  ON public.influencers_cache (platform, last_seen_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ip_platform_last_seen
  ON public.influencer_profiles (platform, last_seen_at DESC NULLS LAST);
-- 5. Backfill: set last_seen_at = updated_at (or now) for existing rows
--    so they don't all appear as NULL/epoch-0.
UPDATE public.influencers_cache
  SET last_seen_at = COALESCE(updated_at, now())
  WHERE last_seen_at IS NULL;
UPDATE public.influencer_profiles
  SET last_seen_at = COALESCE(last_enriched_at, now())
  WHERE last_seen_at IS NULL;
-- 6. Update tag_match_influencers() to also return last_seen_at so the
--    DB-first search path can surface freshness info in results.
-- Must DROP first because return type changes (added last_seen_at column)
DROP FUNCTION IF EXISTS public.tag_match_influencers(TEXT, TEXT[], TEXT, BIGINT, BIGINT, FLOAT, TEXT, INT);
CREATE OR REPLACE FUNCTION public.tag_match_influencers(
  p_platform      TEXT,
  p_tags          TEXT[]      DEFAULT '{}',
  p_niche         TEXT        DEFAULT NULL,
  p_min_followers BIGINT      DEFAULT 0,
  p_max_followers BIGINT      DEFAULT 9999999999,
  p_min_er        FLOAT       DEFAULT 0,
  p_city          TEXT        DEFAULT NULL,
  p_limit         INT         DEFAULT 25
)
RETURNS TABLE (
  id                UUID,
  platform          TEXT,
  username          TEXT,
  full_name         TEXT,
  bio               TEXT,
  follower_count    BIGINT,
  engagement_rate   FLOAT,
  avatar_url        TEXT,
  primary_niche     TEXT,
  city              TEXT,
  tags              TEXT[],
  enrichment_status TEXT,
  last_enriched_at  TIMESTAMPTZ,
  last_seen_at      TIMESTAMPTZ,
  tag_match_count   INT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ip.id,
    ip.platform,
    ip.username,
    ip.full_name,
    ip.bio,
    ip.follower_count,
    ip.engagement_rate,
    ip.avatar_url,
    ip.primary_niche,
    ip.city,
    ip.tags,
    ip.enrichment_status,
    ip.last_enriched_at,
    ip.last_seen_at,
    (
      -- Count how many of the requested tags appear in this profile's tags
      SELECT COUNT(*)::INT
      FROM unnest(p_tags) AS qt
      WHERE qt = ANY(ip.tags)
    ) AS tag_match_count
  FROM public.influencer_profiles ip
  WHERE
    -- Platform filter (NULL = all platforms)
    (p_platform IS NULL OR ip.platform = p_platform)
    -- Follower range
    AND ip.follower_count BETWEEN p_min_followers AND p_max_followers
    -- Engagement rate floor
    AND (p_min_er = 0 OR ip.engagement_rate IS NULL OR ip.engagement_rate >= p_min_er)
    -- Tag OR niche OR city match (at least one signal must match)
    AND (
      -- Has at least one matching tag
      (array_length(p_tags, 1) > 0 AND ip.tags && p_tags)
      -- OR niche matches
      OR (p_niche IS NOT NULL AND ip.primary_niche ILIKE '%' || p_niche || '%')
      -- OR city matches
      OR (p_city IS NOT NULL AND ip.city ILIKE '%' || p_city || '%')
    )
  ORDER BY
    -- Enriched profiles first
    (ip.enrichment_status = 'success') DESC,
    -- Sort by tag overlap
    (
      SELECT COUNT(*)
      FROM unnest(p_tags) AS qt
      WHERE qt = ANY(ip.tags)
    ) DESC,
    -- Then by recency (freshly indexed creators first)
    ip.last_seen_at DESC NULLS LAST,
    -- Finally by follower count
    ip.follower_count DESC
  LIMIT p_limit;
$$;
COMMENT ON FUNCTION public.tag_match_influencers(TEXT, TEXT[], TEXT, BIGINT, BIGINT, FLOAT, TEXT, INT) IS
  'DB-first search: returns creators matching tags/niche/city from the local index. '
  'Used before calling Serper to reduce external API usage. last_seen_at added 2026-03-15.';
