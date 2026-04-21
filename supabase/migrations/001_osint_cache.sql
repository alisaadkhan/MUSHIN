-- ============================================================
-- MUSHIN — OSINT Cache Layer
-- Migration: 001_osint_cache.sql
--
-- Two tables:
--   creators_cache      — canonical creator intelligence records
--   search_queries_log  — query audit trail + cache-hit analytics
-- ============================================================

-- ── Extension: pg_trgm for fuzzy handle/name search ─────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ────────────────────────────────────────────────────────────
-- 1. creators_cache
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creators_cache (

  -- Identity
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  platform              text         NOT NULL CHECK (platform IN ('instagram','tiktok','youtube')),
  handle                text         NOT NULL,  -- @-prefixed, lowercase, no spaces
  display_name          text,
  avatar_url            text,
  bio                   text,
  verified              boolean      NOT NULL DEFAULT false,

  -- Location & classification
  city                  text,        -- Pakistani city from bio/geo signals
  country               text         NOT NULL DEFAULT 'Pakistan',
  niches                text[]       NOT NULL DEFAULT '{}',

  -- Core metrics (raw, from scraper)
  followers             bigint       NOT NULL DEFAULT 0,
  following_count       bigint       NOT NULL DEFAULT 0,
  post_count            integer,
  engagement_rate       numeric(5,2) NOT NULL DEFAULT 0,   -- e.g. 4.25 = 4.25%
  growth_rate_30d       numeric(6,2) NOT NULL DEFAULT 0,   -- % change over 30 days

  -- Platform-specific JSONB blobs
  -- Instagram:  { reelViews, storiesReach, avgLikes, avgComments, thumbnails[] }
  -- TikTok:     { viralVelocity, avgViews, totalLikes, completionRate, videoHistory[] }
  -- YouTube:    { avgViewDuration, avgViews, subscriberGrowth30d, growthHistory[], videosPerMonth }
  platform_data         jsonb        NOT NULL DEFAULT '{}',

  -- Authenticity
  fake_follower_pct     numeric(5,2) NOT NULL DEFAULT 0 CHECK (fake_follower_pct BETWEEN 0 AND 100),

  -- MUSHIN proprietary scoring
  mushin_score          smallint     NOT NULL DEFAULT 0 CHECK (mushin_score BETWEEN 0 AND 100),
  mushin_score_prev     smallint,    -- score from prior indexing cycle (to compute delta)
  score_components      jsonb        NOT NULL DEFAULT '{}',
  -- score_components = {
  --   authenticity:  0-35 (weighted 35%),
  --   engagement:    0-30 (weighted 30%),
  --   growth:        0-20 (weighted 20%),
  --   audience_size: 0-15 (weighted 15%)
  -- }

  -- OSINT enrichment
  enrichment_email          text,       -- email found in bio/linktree/website
  enrichment_email_source   text        CHECK (enrichment_email_source IN ('bio','linktree','website','description')),
  enrichment_whatsapp       text,       -- WhatsApp number (international format)
  enrichment_has_website    boolean     NOT NULL DEFAULT false,
  enrichment_website_url    text,
  enrichment_linked_handles jsonb       NOT NULL DEFAULT '[]',
  -- enrichment_linked_handles = [{ platform, handle }]

  -- Source provenance
  discovered_via        text         NOT NULL DEFAULT 'serper', -- 'serper'|'apify_direct'|'manual'
  serper_query          text,        -- the exact dork that discovered this creator
  apify_run_id          text,        -- Apify run ID for audit trail
  profile_url           text,        -- canonical URL to the public profile

  -- Freshness
  last_updated          timestamptz  NOT NULL DEFAULT now(),
  created_at            timestamptz  NOT NULL DEFAULT now(),

  -- Uniqueness: one row per platform+handle
  CONSTRAINT creators_cache_platform_handle_key UNIQUE (platform, handle)
);

-- ── Staleness helper ─────────────────────────────────────────
-- A creator record is "fresh" if last_updated > NOW() - STALE_THRESHOLD.
-- The threshold is 24 hours by default; override via app.settings.stale_hours.
-- We expose it as a computed column so queries can filter on it directly.
COMMENT ON TABLE creators_cache IS
  'Cache-first OSINT store. Records expire (stale) after 24 hours by default.';

COMMENT ON COLUMN creators_cache.last_updated IS
  'Set on every upsert. Used to compute freshness: fresh = last_updated > NOW() - INTERVAL ''24 hours''.';

-- NOTE: Generated columns require IMMUTABLE expressions; NOW() is STABLE.
-- We therefore do not use a generated `is_stale` column here. Freshness is
-- computed at query time using `last_updated > NOW() - ...` (see get_fresh_creators).

-- ── Indexes ─────────────────────────────────────────────────

-- Primary lookup: platform+handle (covered by UNIQUE constraint above)

-- Filter combination used by discover-creators:
--   WHERE platform = ANY($1) AND city = ANY($2) AND last_updated > NOW() - ...
CREATE INDEX IF NOT EXISTS idx_cc_platform_city_updated
  ON creators_cache (platform, city, last_updated DESC);

-- Niche filter (GIN for ANY/overlap queries on arrays)
CREATE INDEX idx_cc_niches ON creators_cache USING GIN (niches);

-- MUSHIN Score sort (DESC — top creators first)
CREATE INDEX idx_cc_mushin_score ON creators_cache (mushin_score DESC);

-- Full-text search on handle + display_name
CREATE INDEX idx_cc_handle_trgm    ON creators_cache USING GIN (handle gin_trgm_ops);
CREATE INDEX idx_cc_name_trgm      ON creators_cache USING GIN (display_name gin_trgm_ops);

-- Enrichment filters (partial indexes — only rows that have data)
CREATE INDEX idx_cc_has_email      ON creators_cache (enrichment_email)    WHERE enrichment_email IS NOT NULL;
CREATE INDEX idx_cc_has_whatsapp   ON creators_cache (enrichment_whatsapp) WHERE enrichment_whatsapp IS NOT NULL;

-- Follower range queries
CREATE INDEX idx_cc_followers      ON creators_cache (followers);

-- Freshness-only index for the maintenance/vacuum sweep
CREATE INDEX idx_cc_last_updated   ON creators_cache (last_updated DESC);

-- ── Row-Level Security ───────────────────────────────────────
ALTER TABLE creators_cache ENABLE ROW LEVEL SECURITY;

-- Service role (edge functions) has full access
CREATE POLICY "service_role_all" ON creators_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read
CREATE POLICY "authenticated_read" ON creators_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- ── Auto-update last_updated on upsert ──────────────────────
CREATE OR REPLACE FUNCTION touch_creators_cache()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_updated := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_creators_cache
  BEFORE UPDATE ON creators_cache
  FOR EACH ROW EXECUTE FUNCTION touch_creators_cache();


-- ────────────────────────────────────────────────────────────
-- 2. search_queries_log
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS search_queries_log (

  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who queried
  user_id             uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id        uuid,        -- for credit deduction integration later

  -- What was searched
  query_hash          text         NOT NULL,   -- SHA-256 of canonical filter JSON
  filters_json        jsonb        NOT NULL,   -- full filter object for replay/debug

  -- Cache outcome
  cache_hit           boolean      NOT NULL DEFAULT false,
  cache_hit_count     integer      NOT NULL DEFAULT 0,   -- how many results were served from cache
  live_discovery_count integer     NOT NULL DEFAULT 0,   -- how many were freshly scraped

  -- External API usage (for cost tracking)
  serper_calls        smallint     NOT NULL DEFAULT 0,
  serper_results_raw  integer      NOT NULL DEFAULT 0,   -- raw URLs returned
  apify_runs          smallint     NOT NULL DEFAULT 0,
  apify_profiles_scraped integer   NOT NULL DEFAULT 0,

  -- Performance
  total_duration_ms   integer,     -- wall-clock time for the entire edge function
  cache_lookup_ms     integer,     -- just the DB query time
  serper_ms           integer,
  apify_ms            integer,
  scoring_ms          integer,

  -- Result
  result_count        integer      NOT NULL DEFAULT 0,
  error               text,        -- NULL = success

  created_at          timestamptz  NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sql_user_id      ON search_queries_log (user_id);
CREATE INDEX idx_sql_query_hash   ON search_queries_log (query_hash);   -- detect repeated queries
CREATE INDEX idx_sql_created_at   ON search_queries_log (created_at DESC);
CREATE INDEX idx_sql_cache_hit    ON search_queries_log (cache_hit);    -- hit-rate analytics

-- RLS
ALTER TABLE search_queries_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_sql" ON search_queries_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "user_read_own_sql" ON search_queries_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ────────────────────────────────────────────────────────────
-- 3. Helper function: get_fresh_creators
-- Called by the edge function to perform the cache lookup
-- in a single round-trip.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_fresh_creators(
  p_platforms          text[],
  p_cities             text[],
  p_niches             text[],
  p_min_followers      bigint   DEFAULT 10000,
  p_max_followers      bigint   DEFAULT 10000000,
  p_min_mushin_score   smallint DEFAULT 0,
  p_max_fake_pct       numeric  DEFAULT 100,
  p_has_email          boolean  DEFAULT false,
  p_has_whatsapp       boolean  DEFAULT false,
  p_verified_only      boolean  DEFAULT false,
  p_limit              integer  DEFAULT 50,
  p_stale_hours        integer  DEFAULT 24
) RETURNS SETOF creators_cache
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM creators_cache
  WHERE
    -- Freshness gate
    last_updated > (NOW() - make_interval(hours => p_stale_hours))

    -- Platform filter (empty array = all platforms)
    AND (cardinality(p_platforms) = 0 OR platform = ANY(p_platforms))

    -- City filter (empty array = all cities)
    AND (cardinality(p_cities) = 0 OR city = ANY(p_cities))

    -- Niche filter (match ANY of the requested niches)
    AND (cardinality(p_niches) = 0 OR niches && p_niches)

    -- Audience size range
    AND followers BETWEEN p_min_followers AND p_max_followers

    -- Quality gates
    AND mushin_score    >= p_min_mushin_score
    AND fake_follower_pct <= p_max_fake_pct

    -- Optional contact enrichment requirements
    AND (NOT p_has_email    OR enrichment_email    IS NOT NULL)
    AND (NOT p_has_whatsapp OR enrichment_whatsapp IS NOT NULL)
    AND (NOT p_verified_only OR verified = true)

  ORDER BY mushin_score DESC
  LIMIT p_limit;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 4. Helper function: upsert_creator
-- Atomic upsert used by the edge function after enrichment.
-- Returns the final mushin_score so the EF can log it.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_creator(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id          uuid;
  v_prev_score  smallint;
  v_result      jsonb;
BEGIN
  -- Grab any existing score for delta computation
  SELECT mushin_score INTO v_prev_score
  FROM creators_cache
  WHERE platform = (p_data->>'platform')
    AND handle   = (p_data->>'handle');

  INSERT INTO creators_cache (
    platform, handle, display_name, avatar_url, bio, verified,
    city, niches,
    followers, following_count, post_count,
    engagement_rate, growth_rate_30d,
    platform_data,
    fake_follower_pct,
    mushin_score, mushin_score_prev, score_components,
    enrichment_email, enrichment_email_source,
    enrichment_whatsapp,
    enrichment_has_website, enrichment_website_url,
    enrichment_linked_handles,
    discovered_via, serper_query, apify_run_id, profile_url,
    last_updated
  )
  VALUES (
    p_data->>'platform',
    lower(trim(p_data->>'handle')),
    p_data->>'display_name',
    p_data->>'avatar_url',
    p_data->>'bio',
    COALESCE((p_data->>'verified')::boolean, false),
    p_data->>'city',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_data->'niches', '[]'::jsonb))),
    COALESCE((p_data->>'followers')::bigint, 0),
    COALESCE((p_data->>'following_count')::bigint, 0),
    (p_data->>'post_count')::integer,
    COALESCE((p_data->>'engagement_rate')::numeric, 0),
    COALESCE((p_data->>'growth_rate_30d')::numeric, 0),
    COALESCE(p_data->'platform_data', '{}'),
    COALESCE((p_data->>'fake_follower_pct')::numeric, 0),
    COALESCE((p_data->>'mushin_score')::smallint, 0),
    v_prev_score,
    COALESCE(p_data->'score_components', '{}'),
    p_data->>'enrichment_email',
    p_data->>'enrichment_email_source',
    p_data->>'enrichment_whatsapp',
    COALESCE((p_data->>'enrichment_has_website')::boolean, false),
    p_data->>'enrichment_website_url',
    COALESCE(p_data->'enrichment_linked_handles', '[]'),
    COALESCE(p_data->>'discovered_via', 'serper'),
    p_data->>'serper_query',
    p_data->>'apify_run_id',
    p_data->>'profile_url',
    now()
  )
  ON CONFLICT (platform, handle) DO UPDATE SET
    display_name             = EXCLUDED.display_name,
    avatar_url               = EXCLUDED.avatar_url,
    bio                      = EXCLUDED.bio,
    verified                 = EXCLUDED.verified,
    city                     = COALESCE(EXCLUDED.city, creators_cache.city),
    niches                   = CASE WHEN array_length(EXCLUDED.niches, 1) > 0
                                    THEN EXCLUDED.niches
                                    ELSE creators_cache.niches END,
    followers                = EXCLUDED.followers,
    following_count          = EXCLUDED.following_count,
    post_count               = EXCLUDED.post_count,
    engagement_rate          = EXCLUDED.engagement_rate,
    growth_rate_30d          = EXCLUDED.growth_rate_30d,
    platform_data            = EXCLUDED.platform_data,
    fake_follower_pct        = EXCLUDED.fake_follower_pct,
    mushin_score             = EXCLUDED.mushin_score,
    mushin_score_prev        = creators_cache.mushin_score,  -- preserve old score as prev
    score_components         = EXCLUDED.score_components,
    enrichment_email         = COALESCE(EXCLUDED.enrichment_email, creators_cache.enrichment_email),
    enrichment_email_source  = COALESCE(EXCLUDED.enrichment_email_source, creators_cache.enrichment_email_source),
    enrichment_whatsapp      = COALESCE(EXCLUDED.enrichment_whatsapp, creators_cache.enrichment_whatsapp),
    enrichment_has_website   = EXCLUDED.enrichment_has_website,
    enrichment_website_url   = COALESCE(EXCLUDED.enrichment_website_url, creators_cache.enrichment_website_url),
    enrichment_linked_handles = EXCLUDED.enrichment_linked_handles,
    apify_run_id             = EXCLUDED.apify_run_id,
    last_updated             = now()
  RETURNING id, mushin_score INTO v_id, v_prev_score;

  -- v_prev_score is reused as the returned score here for brevity
  RETURN jsonb_build_object('id', v_id, 'mushin_score', v_prev_score);
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 5. Scheduled vacuum: mark truly dead cache entries
-- Run nightly via pg_cron or Supabase scheduled jobs.
-- Deletes records not updated in 7 days (configurable).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION vacuum_stale_creators(p_max_age_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM creators_cache
  WHERE last_updated < NOW() - make_interval(days => p_max_age_days);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 6. Analytics view: cache performance dashboard
-- Useful for the Admin panel.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW cache_analytics AS
SELECT
  date_trunc('hour', created_at)            AS hour,
  COUNT(*)                                  AS total_queries,
  COUNT(*) FILTER (WHERE cache_hit)         AS cache_hits,
  COUNT(*) FILTER (WHERE NOT cache_hit)     AS cache_misses,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE cache_hit) / NULLIF(COUNT(*), 0),
    1
  )                                         AS hit_rate_pct,
  SUM(serper_calls)                         AS total_serper_calls,
  SUM(apify_runs)                           AS total_apify_runs,
  ROUND(AVG(total_duration_ms))             AS avg_duration_ms,
  ROUND(AVG(total_duration_ms) FILTER (WHERE cache_hit))     AS avg_cache_hit_ms,
  ROUND(AVG(total_duration_ms) FILTER (WHERE NOT cache_hit)) AS avg_live_ms
FROM search_queries_log
GROUP BY 1
ORDER BY 1 DESC;
