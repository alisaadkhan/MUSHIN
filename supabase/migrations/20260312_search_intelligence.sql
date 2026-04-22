-- ─────────────────────────────────────────────────────────────────────────────
-- Search Intelligence — Phase 4
-- Applied: 2026-03-12
-- Adds: tags[] column, authenticity_score, engagement_quality_score,
--       search_vector (FTS), GIN indexes, pg_trgm trigram indexes
-- Preserves: embedding vector(1536) and its HNSW index
-- ─────────────────────────────────────────────────────────────────────────────

-- Required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tag system
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.influencers_cache
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.influencer_profiles
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Pre-computed quality scores (written by enrich-influencer function)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.influencers_cache
  ADD COLUMN IF NOT EXISTS authenticity_score    FLOAT CHECK (authenticity_score    BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS engagement_quality_score FLOAT CHECK (engagement_quality_score BETWEEN 0 AND 1);
ALTER TABLE public.influencer_profiles
  ADD COLUMN IF NOT EXISTS authenticity_score    FLOAT CHECK (authenticity_score    BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS engagement_quality_score FLOAT CHECK (engagement_quality_score BETWEEN 0 AND 1);
-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Full-text search vector (stored generated column)
--    Covers: username, display_name, bio, primary_niche
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.5.  Add display_name column to influencers_cache if it doesn't exist
--       (some project deployments omit this column)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.influencers_cache
  ADD COLUMN IF NOT EXISTS display_name TEXT;
-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Full-text search vector (stored generated column)
--    Covers: username, display_name, bio, primary_niche
-- ─────────────────────────────────────────────────────────────────────────────

-- influencers_cache FTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'influencers_cache'
      AND column_name  = 'search_vector'
  ) THEN
    ALTER TABLE public.influencers_cache
      ADD COLUMN search_vector TSVECTOR
        GENERATED ALWAYS AS (
          to_tsvector('simple',
            coalesce(username,     '') || ' ' ||
            coalesce(display_name, '')
          )
        ) STORED;
  END IF;
END;
$$;
-- influencer_profiles FTS (bio + full_name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'influencer_profiles'
      AND column_name  = 'search_vector'
  ) THEN
    ALTER TABLE public.influencer_profiles
      ADD COLUMN search_vector TSVECTOR
        GENERATED ALWAYS AS (
          to_tsvector('simple',
            coalesce(full_name,     '') || ' ' ||
            coalesce(username,      '') || ' ' ||
            coalesce(bio,           '') || ' ' ||
            coalesce(primary_niche, '') || ' ' ||
            coalesce(city,          '')
          )
        ) STORED;
  END IF;
END;
$$;
-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- GIN index on tags arrays (fast @> and && queries)
CREATE INDEX IF NOT EXISTS idx_ic_tags
  ON public.influencers_cache USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ip_tags
  ON public.influencer_profiles USING GIN(tags);
-- GIN index on full-text search vector
CREATE INDEX IF NOT EXISTS idx_ic_search_vector
  ON public.influencers_cache USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_ip_search_vector
  ON public.influencer_profiles USING GIN(search_vector);
-- Trigram indexes for fuzzy name / username matching.
-- `pg_trgm` may be installed under `extensions`, so try both opclass locations.
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ic_username_trgm ON public.influencers_cache USING GIN(username extensions.gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ic_displayname_trgm ON public.influencers_cache USING GIN(display_name extensions.gin_trgm_ops) WHERE display_name IS NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ip_username_trgm ON public.influencer_profiles USING GIN(username extensions.gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ip_fullname_trgm ON public.influencer_profiles USING GIN(full_name extensions.gin_trgm_ops)';
  EXCEPTION WHEN undefined_object THEN
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ic_username_trgm ON public.influencers_cache USING GIN(username gin_trgm_ops)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ic_displayname_trgm ON public.influencers_cache USING GIN(display_name gin_trgm_ops) WHERE display_name IS NOT NULL';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ip_username_trgm ON public.influencer_profiles USING GIN(username gin_trgm_ops)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ip_fullname_trgm ON public.influencer_profiles USING GIN(full_name gin_trgm_ops)';
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
  END;
END;
$$;
-- Composite index for quality-score-based listings
CREATE INDEX IF NOT EXISTS idx_ic_quality_scores
  ON public.influencers_cache (authenticity_score DESC, engagement_quality_score DESC)
  WHERE authenticity_score IS NOT NULL;
-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Helper function: tag search (GIN + partial match combined)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.search_by_tags(
  p_tags      TEXT[],
  p_platform  TEXT        DEFAULT NULL,
  p_limit     INT         DEFAULT 20
)
RETURNS TABLE (
  id                    UUID,
  username              TEXT,
  platform              TEXT,
  display_name          TEXT,
  primary_niche         TEXT,
  tags                  TEXT[],
  follower_count        BIGINT,
  engagement_rate       FLOAT,
  authenticity_score    FLOAT,
  engagement_quality_score FLOAT,
  tag_match_count       INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ic.id,
    ic.username,
    ic.platform,
    ic.display_name,
    (ic.data->>'niche')::TEXT,
    ic.tags,
    (ic.data->>'followers')::BIGINT,
    (ic.data->>'engagement_rate')::FLOAT,
    ic.authenticity_score,
    ic.engagement_quality_score,
    -- count of matched tags (used externally for scoring)
    (SELECT COUNT(*)::INT FROM unnest(p_tags) AS qt WHERE qt = ANY(ic.tags)) AS tag_match_count
  FROM public.influencers_cache ic
  WHERE ic.tags && p_tags   -- GIN-accelerated array overlap
    AND (p_platform IS NULL OR ic.platform = p_platform)
  ORDER BY tag_match_count DESC, (ic.data->>'engagement_rate')::FLOAT DESC NULLS LAST
  LIMIT p_limit;
$$;
-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Helper function: FTS search (multilingual simple config)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fts_search_influencers(
  p_query    TEXT,
  p_platform TEXT DEFAULT NULL,
  p_limit    INT  DEFAULT 20
)
RETURNS TABLE (
  id              UUID,
  username        TEXT,
  platform        TEXT,
  display_name    TEXT,
  primary_niche   TEXT,
  follower_count  BIGINT,
  engagement_rate FLOAT,
  fts_rank        FLOAT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ic.id,
    ic.username,
    ic.platform,
    ic.display_name,
    (ic.data->>'niche')::TEXT,
    (ic.data->>'followers')::BIGINT,
    (ic.data->>'engagement_rate')::FLOAT,
    ts_rank(ic.search_vector, to_tsquery('simple', p_query)) AS fts_rank
  FROM public.influencers_cache ic
  WHERE ic.search_vector @@ to_tsquery('simple', p_query)
    AND (p_platform IS NULL OR ic.platform = p_platform)
  ORDER BY fts_rank DESC, (ic.data->>'engagement_rate')::FLOAT DESC NULLS LAST
  LIMIT p_limit;
$$;
-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS — service_role bypass for new functions (already inherits from table)
-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER handles elevation; no additional RLS config needed.

COMMENT ON COLUMN public.influencers_cache.tags
  IS 'Free-form niche/content tags assigned during enrichment. Used for GIN-accelerated tag-match ranking.';
COMMENT ON COLUMN public.influencers_cache.authenticity_score
  IS 'Pre-computed audience authenticity [0,1]. 1 = fully authentic. Written by enrich-influencer.';
COMMENT ON COLUMN public.influencers_cache.engagement_quality_score
  IS 'Pre-computed engagement quality vs platform benchmark [0,1]. Written by enrich-influencer.';
COMMENT ON COLUMN public.influencers_cache.search_vector
  IS 'Generated tsvector for FTS. Updated automatically (STORED generated column).';
