-- ─────────────────────────────────────────────────────────────────────────────
-- Automated Creator Monitoring — Phase 6
-- Applied: 2026-03-15
-- Adds: trending_niches table, first_seen / channel_url fields,
--       discovery_runs audit table, pg_cron schedules for automated workers.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ensure pg_cron extension is available
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add missing creator-index fields to influencer_profiles
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.influencer_profiles
  ADD COLUMN IF NOT EXISTS first_seen_at    TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS channel_url      TEXT,
  ADD COLUMN IF NOT EXISTS last_updated_at  TIMESTAMPTZ DEFAULT now();

-- Backfill first_seen_at from created_at where possible
UPDATE public.influencer_profiles
  SET first_seen_at = COALESCE(created_at, now())
  WHERE first_seen_at IS NULL;

-- Index on first_seen_at for new-creator queries
CREATE INDEX IF NOT EXISTS idx_ip_first_seen_at
  ON public.influencer_profiles (first_seen_at DESC NULLS LAST);

-- Channel URL unique index (allows null, unique where present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_channel_url
  ON public.influencer_profiles (channel_url)
  WHERE channel_url IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. trending_niches table
--    Populated by the trending-niches-analyzer worker.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trending_niches (
  id               BIGSERIAL PRIMARY KEY,
  tag              TEXT        NOT NULL,
  platform         TEXT        NOT NULL DEFAULT 'all',
  trend_score      FLOAT       NOT NULL DEFAULT 0,
  discovery_count  INT         NOT NULL DEFAULT 0,
  creator_count    INT         NOT NULL DEFAULT 0,
  avg_engagement   FLOAT,
  last_updated     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tag, platform)
);

CREATE INDEX IF NOT EXISTS idx_tn_trend_score
  ON public.trending_niches (trend_score DESC);

CREATE INDEX IF NOT EXISTS idx_tn_platform_score
  ON public.trending_niches (platform, trend_score DESC);

-- RLS: read-only for authenticated users, full access via service role
ALTER TABLE public.trending_niches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read trending niches" ON public.trending_niches;
CREATE POLICY "Authenticated users can read trending niches"
  ON public.trending_niches FOR SELECT
  TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. discovery_runs audit table
--    Tracks each automated worker run for debugging and monitoring.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.discovery_runs (
  id              BIGSERIAL PRIMARY KEY,
  run_type        TEXT        NOT NULL,  -- 'scheduled_discovery' | 'trending_analysis' | 'refresh'
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  queries_run     INT         DEFAULT 0,
  creators_found  INT         DEFAULT 0,
  creators_new    INT         DEFAULT 0,
  creators_updated INT        DEFAULT 0,
  error_count     INT         DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'running', -- 'running' | 'success' | 'error'
  meta            JSONB
);

CREATE INDEX IF NOT EXISTS idx_dr_run_type_started
  ON public.discovery_runs (run_type, started_at DESC);

-- Auto-cleanup: delete runs older than 30 days to keep table lean
CREATE INDEX IF NOT EXISTS idx_dr_started_at
  ON public.discovery_runs (started_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. creator_refresh_schedule view — tiered refresh priority
--    Exposes which profiles are due for a refresh based on growth tier.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.creator_refresh_queue AS
  SELECT
    ip.id,
    ip.platform,
    ip.username,
    ip.follower_count,
    ip.engagement_rate,
    ip.primary_niche,
    ip.enrichment_status,
    ip.last_enriched_at,
    ip.last_seen_at,
    -- Tier classification
    CASE
      WHEN ip.follower_count >= 500_000                             THEN 'high_growth'   -- every 24h
      WHEN ip.follower_count >= 50_000                              THEN 'active'        -- every 3 days
      ELSE                                                               'inactive'      -- every 7 days
    END AS refresh_tier,
    -- Hours since last enrichment
    EXTRACT(EPOCH FROM (now() - COALESCE(ip.last_enriched_at, ip.created_at - INTERVAL '999 days')))
      / 3600 AS hours_since_refresh,
    -- Is refresh due?
    CASE
      WHEN ip.follower_count >= 500_000
        AND COALESCE(ip.last_enriched_at, now() - INTERVAL '999 days') < now() - INTERVAL '24 hours'
        THEN true
      WHEN ip.follower_count >= 50_000
        AND COALESCE(ip.last_enriched_at, now() - INTERVAL '999 days') < now() - INTERVAL '3 days'
        THEN true
      WHEN COALESCE(ip.last_enriched_at, now() - INTERVAL '999 days') < now() - INTERVAL '7 days'
        THEN true
      ELSE false
    END AS refresh_due
  FROM public.influencer_profiles ip
  WHERE ip.enrichment_status = 'success'
  ORDER BY
    refresh_due DESC,
    ip.follower_count DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. pg_cron schedules
--    Note: pg_cron jobs call the edge functions via pg_net HTTP requests.
--    The SUPABASE_URL and SERVICE_KEY used below must match your project.
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove any existing cron schedules for these workers (idempotent)
SELECT cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'creator-discovery-worker',
    'creator-refresh-monitor',
    'trending-niches-analyzer',
    'discovery-run-cleanup'
  );

-- Every 6 hours: discover new creators
SELECT cron.schedule(
  'creator-discovery-worker',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/creator-discovery-worker',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{"triggered_by":"pg_cron"}'::jsonb
  );
  $$
);

-- Every 4 hours: refresh stale profiles (tiered)
SELECT cron.schedule(
  'creator-refresh-monitor',
  '30 */4 * * *',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/creator-refresh-monitor',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{"triggered_by":"pg_cron"}'::jsonb
  );
  $$
);

-- Every 12 hours: analyze trending niches
SELECT cron.schedule(
  'trending-niches-analyzer',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/trending-niches-analyzer',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{"triggered_by":"pg_cron"}'::jsonb
  );
  $$
);

-- Daily cleanup: remove discovery_runs older than 30 days
SELECT cron.schedule(
  'discovery-run-cleanup',
  '0 3 * * *',
  $$
  DELETE FROM public.discovery_runs
    WHERE started_at < now() - INTERVAL '30 days';
  $$
);
