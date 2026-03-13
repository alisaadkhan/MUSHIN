-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 10 — Verification Audit Fixes
-- Applied: 2026-03-03
-- Findings from end-to-end functional verification of Phase 1–9 remediation.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: system_integrity_audit uses wrong column name on enrichment_jobs
-- ─────────────────────────────────────────────────────────────────────────────
-- Root cause: 20260301_credit_fix.sql created enrichment_jobs with `last_error`
-- but 20260303_integrity_audit_fix.sql writes to `error_message` (schema from
-- the phase6 CREATE TABLE IF NOT EXISTS that was skipped because the table
-- already existed). The UPDATE silently fails on Postgres 14+ or raises an
-- undefined_column error.
-- Fix: reconcile by adding error_message as an alias column populated by trigger,
-- OR just update system_integrity_audit to use the correct column.

-- First, ensure the enrichment_jobs table has last_error column (idempotent)
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS last_error text;
-- Rebuild system_integrity_audit using last_error
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
    -- FIX: use last_error (actual column name) not error_message
    UPDATE enrichment_jobs
    SET status = 'failed', last_error = 'Stuck in processing — reset by integrity audit'
    WHERE status = 'processing' AND created_at < now() - INTERVAL '10 minutes';
  END IF;

  result := jsonb_build_object(
    'audit_timestamp', now(),
    'checks', jsonb_build_object(
      'null_enriched_profiles',   jsonb_build_object('count', v_null_enriched,      'status', CASE WHEN v_null_enriched = 0     THEN 'pass' ELSE 'warn' END),
      'stuck_processing_jobs',    jsonb_build_object('count', v_stuck_processing,   'status', CASE WHEN v_stuck_processing = 0   THEN 'pass' ELSE 'fixed' END),
      'orphaned_posts',           jsonb_build_object('count', v_orphaned_posts,     'status', CASE WHEN v_orphaned_posts = 0     THEN 'pass' ELSE 'warn' END),
      'stale_real_profiles',      jsonb_build_object('count', v_stale_real_profiles,'status', CASE WHEN v_stale_real_profiles = 0 THEN 'pass' ELSE 'warn' END),
      'negative_credits',         jsonb_build_object('count', v_negative_credits,   'status', CASE WHEN v_negative_credits = 0   THEN 'pass' ELSE 'fail' END),
      'expired_evaluations',      jsonb_build_object('count', v_expired_evals,      'status', CASE WHEN v_expired_evals = 0      THEN 'pass' ELSE 'warn' END)
    ),
    'overall', CASE
      WHEN v_negative_credits > 0 THEN 'fail'
      WHEN v_null_enriched > 0 OR v_stale_real_profiles > 0 OR v_expired_evals > 0 THEN 'warn'
      ELSE 'pass'
    END
  );

  -- Use admin_user_id column (fixed in 20260303) and last_error column (fixed here)
  INSERT INTO admin_audit_log(action, admin_user_id, details)
  VALUES ('system_integrity_audit', '00000000-0000-0000-0000-000000000001'::uuid, result);

  RETURN result;
END;
$$;
-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: follower_history RLS — tighten predicate to match policy name
-- ─────────────────────────────────────────────────────────────────────────────
-- Root cause: The existing policy is named "Workspace members can read follower
-- history" but the USING predicate allows ALL authenticated users. It does not
-- scope to workspace membership. Since follower_history.profile_id → influencer_profiles
-- which are shared public data (not workspace-private), the appropriate access
-- level is: any authenticated user who is a member of at least one workspace.
-- This prevents unauthenticated reads while maintaining shared-profile semantics.

DROP POLICY IF EXISTS "Workspace members can read follower history" ON public.follower_history;
CREATE POLICY "Authenticated workspace members can read follower history"
  ON public.follower_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );
-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: influencer_profiles RLS — block truly unauthenticated anonymous access
-- ─────────────────────────────────────────────────────────────────────────────
-- The existing SELECT policy uses auth.role() = 'authenticated' which correctly
-- blocks anon/unauthenticated reads. No change needed — documenting for clarity.

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification: ensure enrichment_jobs has both last_error and attempt_count
-- (process-enrichment-job reads job.attempt_count to compute backoff)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0;
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 3;
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
