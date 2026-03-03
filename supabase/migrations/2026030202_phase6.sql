-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 6 MIGRATION — influenceiq
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. FIX: consume_search_credit uses wrong column name ─────────────────────
-- The existing function in 20260227_arch_fixes.sql uses ai_search_credits_remaining
-- but the workspaces table has search_credits_remaining. All searches have been free.
CREATE OR REPLACE FUNCTION consume_search_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE workspaces
  SET search_credits_remaining = search_credits_remaining - 1
  WHERE id = ws_id
    AND search_credits_remaining > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ─── 2. AI evaluation versioning & expiry ─────────────────────────────────────
ALTER TABLE public.influencer_evaluations
  ADD COLUMN IF NOT EXISTS evaluation_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Set expiry on all existing rows (90-day rolling window)
UPDATE public.influencer_evaluations
SET expires_at = evaluated_at + INTERVAL '90 days'
WHERE expires_at IS NULL;

-- ─── 3. Enrichment TTL columns ────────────────────────────────────────────────
-- enriched_at already exists. We add last_enriched_at as alias + TTL control.
ALTER TABLE public.influencer_profiles
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_ttl_days int NOT NULL DEFAULT 30;

-- Backfill last_enriched_at from existing enriched_at
UPDATE public.influencer_profiles
SET last_enriched_at = enriched_at
WHERE last_enriched_at IS NULL AND enriched_at IS NOT NULL;

-- ─── 4. Engagement benchmark table (replaces hash-function estimates) ─────────
CREATE TABLE IF NOT EXISTS public.engagement_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  follower_bucket text NOT NULL,   -- 'nano','micro','mid','macro','mega'
  min_followers bigint NOT NULL,
  max_followers bigint NOT NULL,
  median_er numeric(5,2) NOT NULL,  -- median engagement rate %
  p25_er numeric(5,2) NOT NULL,     -- 25th percentile
  p75_er numeric(5,2) NOT NULL,     -- 75th percentile
  primary_niche text DEFAULT NULL,  -- NULL = all niches
  source text NOT NULL DEFAULT 'industry_research',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, follower_bucket, primary_niche)
);

-- Seed with industry-researched benchmarks (2024/2025 data)
-- Instagram benchmarks
INSERT INTO public.engagement_benchmarks (platform, follower_bucket, min_followers, max_followers, median_er, p25_er, p75_er) VALUES
  ('instagram','nano',    1000,    10000, 4.20, 2.50, 7.10),
  ('instagram','micro',  10000,    50000, 2.80, 1.80, 4.50),
  ('instagram','mid',    50000,   100000, 2.10, 1.30, 3.40),
  ('instagram','macro', 100000,   500000, 1.60, 0.90, 2.80),
  ('instagram','mega',  500000, 999999999,1.10, 0.60, 2.00)
ON CONFLICT (platform, follower_bucket, primary_niche) DO UPDATE
  SET median_er=EXCLUDED.median_er, p25_er=EXCLUDED.p25_er, p75_er=EXCLUDED.p75_er, updated_at=now();

-- TikTok benchmarks
INSERT INTO public.engagement_benchmarks (platform, follower_bucket, min_followers, max_followers, median_er, p25_er, p75_er) VALUES
  ('tiktok','nano',    1000,    10000, 7.80, 4.20,12.50),
  ('tiktok','micro',  10000,    50000, 5.90, 3.10, 9.40),
  ('tiktok','mid',    50000,   100000, 4.40, 2.30, 7.20),
  ('tiktok','macro', 100000,   500000, 3.20, 1.60, 5.80),
  ('tiktok','mega',  500000, 999999999,2.10, 0.90, 4.10)
ON CONFLICT (platform, follower_bucket, primary_niche) DO UPDATE
  SET median_er=EXCLUDED.median_er, p25_er=EXCLUDED.p25_er, p75_er=EXCLUDED.p75_er, updated_at=now();

-- YouTube benchmarks
INSERT INTO public.engagement_benchmarks (platform, follower_bucket, min_followers, max_followers, median_er, p25_er, p75_er) VALUES
  ('youtube','nano',    1000,    10000, 3.50, 1.90, 6.20),
  ('youtube','micro',  10000,    50000, 2.80, 1.40, 5.10),
  ('youtube','mid',    50000,   100000, 2.20, 1.10, 3.90),
  ('youtube','macro', 100000,   500000, 1.70, 0.80, 3.20),
  ('youtube','mega',  500000, 999999999,1.20, 0.50, 2.60)
ON CONFLICT (platform, follower_bucket, primary_niche) DO UPDATE
  SET median_er=EXCLUDED.median_er, p25_er=EXCLUDED.p25_er, p75_er=EXCLUDED.p75_er, updated_at=now();

ALTER TABLE public.engagement_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read benchmarks" ON public.engagement_benchmarks
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role manages benchmarks" ON public.engagement_benchmarks
  FOR ALL USING (auth.role() = 'service_role');

-- ─── 5. Enrichment failure log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrichment_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  username text NOT NULL,
  error_message text NOT NULL,
  error_type text,    -- 'apify_timeout','apify_not_found','youtube_quota','network','unknown'
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enrichment_failures_created
  ON public.enrichment_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_failures_platform
  ON public.enrichment_failures(platform, created_at DESC);

ALTER TABLE public.enrichment_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read failures" ON public.enrichment_failures
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','super_admin'))
  );
CREATE POLICY "Service role manages failures" ON public.enrichment_failures
  FOR ALL USING (auth.role() = 'service_role');

-- ─── 6. Niche correction storage ──────────────────────────────────────────────
ALTER TABLE public.influencer_profiles
  ADD COLUMN IF NOT EXISTS niche_confidence int CHECK (niche_confidence BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS niche_corrected_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS niche_corrected_at timestamptz,
  ADD COLUMN IF NOT EXISTS niche_original text;

CREATE OR REPLACE FUNCTION correct_influencer_niche(
  p_profile_id uuid,
  p_new_niche text,
  p_correcting_user uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.influencer_profiles
  SET
    niche_original = COALESCE(niche_original, primary_niche),
    primary_niche = p_new_niche,
    niche_confidence = 100,
    niche_corrected_by = p_correcting_user,
    niche_corrected_at = now()
  WHERE id = p_profile_id;
END;
$$;

-- View for niche training dataset (export when 200+ corrections accumulated)
DROP VIEW IF EXISTS public.niche_training_data;
CREATE OR REPLACE VIEW public.niche_training_data AS
SELECT platform, username, bio, primary_niche AS corrected_niche,
       niche_original AS ai_predicted_niche, niche_corrected_at
FROM public.influencer_profiles
WHERE niche_corrected_by IS NOT NULL
ORDER BY niche_corrected_at DESC;

-- ─── 7. System integrity audit function ───────────────────────────────────────
CREATE OR REPLACE FUNCTION system_integrity_audit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{}';
  v_null_enriched int;
  v_stuck_processing int;
  v_orphaned_posts int;
  v_orphaned_history int;
  v_duplicate_usernames int;
  v_stale_real_profiles int;
  v_negative_credits int;
  v_expired_evals int;
BEGIN
  -- Profiles enriched but missing critical fields
  SELECT COUNT(*) INTO v_null_enriched
  FROM influencer_profiles
  WHERE enrichment_status = 'success'
    AND (follower_count IS NULL OR engagement_rate IS NULL);

  -- Jobs stuck in processing > 10 minutes (timeout)
  SELECT COUNT(*) INTO v_stuck_processing
  FROM enrichment_jobs
  WHERE status = 'processing'
    AND created_at < now() - INTERVAL '10 minutes';

  -- Posts with no matching profile (orphaned)
  SELECT COUNT(*) INTO v_orphaned_posts
  FROM influencer_posts ip
  LEFT JOIN influencer_profiles p ON p.id = ip.profile_id
  WHERE p.id IS NULL;

  -- Follower history with no profile
  SELECT COUNT(*) INTO v_orphaned_history
  FROM follower_history fh
  LEFT JOIN influencer_profiles p ON p.id = fh.profile_id
  WHERE p.id IS NULL;

  -- Duplicate username/platform combos (should be 0 due to UNIQUE constraint)
  SELECT COUNT(*) INTO v_duplicate_usernames
  FROM (
    SELECT platform, username, COUNT(*) AS cnt
    FROM influencer_profiles
    GROUP BY platform, username
    HAVING COUNT(*) > 1
  ) dupes;

  -- Profiles with enrichment_status=success but last_enriched_at > TTL (stale)
  SELECT COUNT(*) INTO v_stale_real_profiles
  FROM influencer_profiles
  WHERE enrichment_status = 'success'
    AND last_enriched_at IS NOT NULL
    AND last_enriched_at < now() - (enrichment_ttl_days || ' days')::interval;

  -- Workspaces with negative credit balances
  SELECT COUNT(*) INTO v_negative_credits
  FROM workspaces
  WHERE search_credits_remaining < 0
     OR enrichment_credits_remaining < 0
     OR ai_credits_remaining < 0;

  -- Expired AI evaluations still in use
  SELECT COUNT(*) INTO v_expired_evals
  FROM influencer_evaluations
  WHERE expires_at IS NOT NULL AND expires_at < now();

  -- Repair stuck jobs immediately
  IF v_stuck_processing > 0 THEN
    UPDATE enrichment_jobs
    SET status = 'failed', error_message = 'Stuck in processing — reset by integrity audit'
    WHERE status = 'processing'
      AND created_at < now() - INTERVAL '10 minutes';
  END IF;

  result := jsonb_build_object(
    'audit_timestamp', now(),
    'checks', jsonb_build_object(
      'null_enriched_profiles',   jsonb_build_object('count', v_null_enriched,    'status', CASE WHEN v_null_enriched = 0 THEN 'pass' ELSE 'warn' END),
      'stuck_processing_jobs',    jsonb_build_object('count', v_stuck_processing,  'status', CASE WHEN v_stuck_processing = 0 THEN 'pass' ELSE 'fixed' END),
      'orphaned_posts',           jsonb_build_object('count', v_orphaned_posts,    'status', CASE WHEN v_orphaned_posts = 0 THEN 'pass' ELSE 'warn' END),
      'orphaned_follower_history',jsonb_build_object('count', v_orphaned_history,  'status', CASE WHEN v_orphaned_history = 0 THEN 'pass' ELSE 'warn' END),
      'duplicate_usernames',      jsonb_build_object('count', v_duplicate_usernames,'status', CASE WHEN v_duplicate_usernames = 0 THEN 'pass' ELSE 'fail' END),
      'stale_real_profiles',      jsonb_build_object('count', v_stale_real_profiles,'status', CASE WHEN v_stale_real_profiles = 0 THEN 'pass' ELSE 'warn' END),
      'negative_credits',         jsonb_build_object('count', v_negative_credits,  'status', CASE WHEN v_negative_credits = 0 THEN 'pass' ELSE 'fail' END),
      'expired_evaluations',      jsonb_build_object('count', v_expired_evals,     'status', CASE WHEN v_expired_evals = 0 THEN 'pass' ELSE 'warn' END)
    ),
    'overall', CASE
      WHEN v_duplicate_usernames > 0 OR v_negative_credits > 0 THEN 'fail'
      WHEN v_null_enriched > 0 OR v_orphaned_posts > 0 OR v_stale_real_profiles > 0 OR v_expired_evals > 0 THEN 'warn'
      ELSE 'pass'
    END
  );

  -- Log to audit table
  INSERT INTO admin_audit_log(action, admin_user_id, details)
  VALUES ('system_integrity_audit', '00000000-0000-0000-0000-000000000001'::uuid, result);

  RETURN result;
END;
$$;

-- ─── 8. pg_cron schedules (requires pg_cron extension enabled in Supabase dashboard) ──
-- Enable in Supabase dashboard → Database → Extensions → pg_cron
-- Then run this SQL:
-- SELECT cron.schedule('nightly-integrity-audit', '0 3 * * *', 'SELECT system_integrity_audit()');
-- SELECT cron.schedule('nightly-stale-refresh', '0 2 * * *', $$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_functions_url') || '/refresh-stale-profiles',
--     headers := '{"Authorization":"Bearer "}'  || current_setting('app.service_role_key') || '"}',
--     body := '{}'
--   )
-- $$);
-- SELECT cron.schedule('monthly-credit-reset', '1 0 1 * *', $$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_functions_url') || '/reset-free-credits',
--     headers := jsonb_build_object('Authorization','Bearer ' || current_setting('app.service_role_key'))::text,
--     body := '{}'
--   )
-- $$);

-- ─── 9. Atomic consume_email_credit (fixes dead empty-string RPC) ────────────
CREATE OR REPLACE FUNCTION consume_email_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE workspaces
  SET email_sends_remaining = email_sends_remaining - 1
  WHERE id = ws_id
    AND email_sends_remaining > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ─── 10. Follower growth spike view (for bot detection signal 16) ─────────────
DROP VIEW IF EXISTS public.follower_growth_signals;
CREATE OR REPLACE VIEW public.follower_growth_signals AS
WITH raw_delta AS (
  SELECT
    profile_id,
    recorded_at,
    follower_count,
    LAG(follower_count) OVER (PARTITION BY profile_id ORDER BY recorded_at) AS prev_count,
    follower_count - LAG(follower_count) OVER (PARTITION BY profile_id ORDER BY recorded_at) AS delta
  FROM public.follower_history
),
rolling_avg AS (
  SELECT
    profile_id,
    recorded_at,
    follower_count,
    prev_count,
    delta,
    AVG(delta) OVER (
      PARTITION BY profile_id
      ORDER BY recorded_at
      ROWS BETWEEN 7 PRECEDING AND 1 PRECEDING
    ) AS avg_7day_delta
  FROM raw_delta
)
SELECT
  profile_id,
  recorded_at,
  follower_count,
  prev_count,
  delta,
  avg_7day_delta,
  CASE
    WHEN delta > 5 * NULLIF(avg_7day_delta, 0) THEN true
    ELSE false
  END AS is_growth_spike
FROM rolling_avg;

-- ─── 11. claim_enrichment_jobs: atomic batch claim with FOR UPDATE SKIP LOCKED ────────
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS started_at timestamptz;

CREATE OR REPLACE FUNCTION claim_enrichment_jobs(batch_size int DEFAULT 5)
RETURNS SETOF enrichment_jobs
LANGUAGE sql
AS $$
  UPDATE enrichment_jobs
  SET status = 'processing', started_at = now()
  WHERE id IN (
    SELECT id FROM enrichment_jobs
    WHERE status = 'queued'
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
    ORDER BY created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
