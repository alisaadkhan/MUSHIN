-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 11 — System Audit Fixes
-- Applied: 2026-03-11
-- Covers: C-1 (integrity audit wrong column), C-2 (bot signals cache columns),
--         M-4 (match_influencers null embedding crash), L-1 (DROP FUNCTION arg
--         types), L-4 (cron unschedule PERFORM)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- C-1: Re-apply correct system_integrity_audit() using last_error
-- Migration 20260309_integrity_audit_fix.sql re-introduced the wrong column
-- name (error_message) that 20260307_phase10_verification_fixes.sql had fixed.
-- This migration re-instates the correct version.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS last_error text;
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
  v_stale_real_profiles int;
  v_negative_credits int;
  v_expired_evals int;
BEGIN
  SELECT COUNT(*) INTO v_null_enriched
  FROM influencer_profiles
  WHERE enrichment_status = 'success' AND (follower_count IS NULL OR engagement_rate IS NULL);

  SELECT COUNT(*) INTO v_stuck_processing
  FROM enrichment_jobs
  WHERE status = 'processing' AND created_at < now() - INTERVAL '10 minutes';

  SELECT COUNT(*) INTO v_orphaned_posts
  FROM influencer_posts ip
  LEFT JOIN influencer_profiles p ON p.id = ip.profile_id
  WHERE p.id IS NULL;

  SELECT COUNT(*) INTO v_stale_real_profiles
  FROM influencer_profiles
  WHERE enrichment_status = 'success'
    AND last_enriched_at IS NOT NULL
    AND last_enriched_at < now() - (enrichment_ttl_days || ' days')::interval;

  SELECT COUNT(*) INTO v_negative_credits
  FROM workspaces
  WHERE search_credits_remaining < 0
     OR enrichment_credits_remaining < 0
     OR ai_credits_remaining < 0;

  SELECT COUNT(*) INTO v_expired_evals
  FROM influencer_evaluations
  WHERE expires_at IS NOT NULL AND expires_at < now();

  IF v_stuck_processing > 0 THEN
    -- CORRECT: use last_error (actual column name), not error_message
    UPDATE enrichment_jobs
    SET status = 'failed', last_error = 'Stuck in processing — reset by integrity audit'
    WHERE status = 'processing' AND created_at < now() - INTERVAL '10 minutes';
  END IF;

  result := jsonb_build_object(
    'audit_timestamp', now(),
    'checks', jsonb_build_object(
      'null_enriched_profiles',    jsonb_build_object('count', v_null_enriched,      'status', CASE WHEN v_null_enriched = 0      THEN 'pass' ELSE 'warn' END),
      'stuck_processing_jobs',     jsonb_build_object('count', v_stuck_processing,   'status', CASE WHEN v_stuck_processing = 0   THEN 'pass' ELSE 'fixed' END),
      'orphaned_posts',            jsonb_build_object('count', v_orphaned_posts,     'status', CASE WHEN v_orphaned_posts = 0     THEN 'pass' ELSE 'warn' END),
      'stale_real_profiles',       jsonb_build_object('count', v_stale_real_profiles,'status', CASE WHEN v_stale_real_profiles = 0 THEN 'pass' ELSE 'warn' END),
      'negative_credits',          jsonb_build_object('count', v_negative_credits,   'status', CASE WHEN v_negative_credits = 0   THEN 'pass' ELSE 'fail' END),
      'expired_evaluations',       jsonb_build_object('count', v_expired_evals,      'status', CASE WHEN v_expired_evals = 0      THEN 'pass' ELSE 'warn' END)
    ),
    'overall', CASE
      WHEN v_negative_credits > 0 THEN 'fail'
      WHEN v_null_enriched > 0 OR v_stale_real_profiles > 0 OR v_expired_evals > 0 THEN 'warn'
      ELSE 'pass'
    END
  );

  INSERT INTO admin_audit_log(action, admin_user_id, details)
  VALUES ('system_integrity_audit', '00000000-0000-0000-0000-000000000001'::uuid, result);

  RETURN result;
END;
$$;
-- ─────────────────────────────────────────────────────────────────────────────
-- C-2: Add bot_signals cache columns to influencer_profiles
-- Prevents detect-bot-entendre from being called on every profile load.
-- The hook will skip the edge function call when cached data is < 7 days old.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.influencer_profiles
  ADD COLUMN IF NOT EXISTS bot_signals jsonb,
  ADD COLUMN IF NOT EXISTS bot_signals_computed_at timestamptz;
-- ─────────────────────────────────────────────────────────────────────────────
-- L-1 + M-4: Drop and recreate match_influencers with correct arg types and
-- NULL embedding guard
-- L-1: Original DROP lacked arg types — could silently no-op or error.
-- M-4: Cosine distance on NULL embedding crashes or drops rows silently.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.match_influencers(vector(1536), float, int, text);
CREATE OR REPLACE FUNCTION public.match_influencers(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_platform text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  username text,
  platform text,
  full_name text,
  primary_niche text,
  profile_pic_url text,
  follower_count bigint,
  engagement_rate numeric,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ip.id,
    ip.username,
    ip.platform,
    ip.full_name,
    ip.primary_niche,
    ip.profile_pic_url,
    ip.follower_count,
    ip.engagement_rate,
    1 - (ip.embedding <=> query_embedding) AS similarity
  FROM public.influencer_profiles ip
  WHERE ip.embedding IS NOT NULL  -- M-4: guard against NULL embedding crash
    AND 1 - (ip.embedding <=> query_embedding) > match_threshold
    AND (filter_platform IS NULL OR ip.platform = filter_platform)
  ORDER BY ip.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
-- ─────────────────────────────────────────────────────────────────────────────
-- L-4: Fix cron.unschedule() calls — must use PERFORM inside PL/pgSQL DO blocks
-- Also isolate each unschedule in its own BEGIN/EXCEPTION so one missing
-- schedule does not abort the others.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('refresh-stale-profiles');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM cron.unschedule('process-enrichments');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM cron.unschedule('monthly-credit-reset');
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
-- Recreate the schedules (idempotent — unscheduled above)
DO $$
BEGIN
  PERFORM cron.schedule(
    'refresh-stale-profiles',
    '0 3 * * *',
    $cron$
    SELECT net.http_post(
        url:=(current_setting('app.supabase_functions_url') || '/refresh-stale-profiles')::text,
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        )
    )
    $cron$
  );

  PERFORM cron.schedule(
    'process-enrichments',
    '* * * * *',
    $cron$
    SELECT net.http_post(
        url:=(current_setting('app.supabase_functions_url') || '/process-enrichment-job')::text,
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        )
    )
    $cron$
  );

  PERFORM cron.schedule(
    'monthly-credit-reset',
    '0 0 1 * *',
    $cron$
    SELECT net.http_post(
        url:=(current_setting('app.supabase_functions_url') || '/reset-free-credits')::text,
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        )
    )
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping cron schedule creation; ensure app.supabase_functions_url is set.';
END $$;
