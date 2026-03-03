-- Fix system_integrity_audit() — wrong column name caused nightly crash
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
    UPDATE enrichment_jobs
    SET status = 'failed', error_message = 'Stuck in processing — reset by integrity audit'
    WHERE status = 'processing' AND created_at < now() - INTERVAL '10 minutes';
  END IF;

  result := jsonb_build_object(
    'audit_timestamp', now(),
    'checks', jsonb_build_object(
      'null_enriched_profiles',   jsonb_build_object('count', v_null_enriched,     'status', CASE WHEN v_null_enriched = 0    THEN 'pass' ELSE 'warn' END),
      'stuck_processing_jobs',    jsonb_build_object('count', v_stuck_processing,  'status', CASE WHEN v_stuck_processing = 0  THEN 'pass' ELSE 'fixed' END),
      'orphaned_posts',           jsonb_build_object('count', v_orphaned_posts,    'status', CASE WHEN v_orphaned_posts = 0    THEN 'pass' ELSE 'warn' END),
      'stale_real_profiles',      jsonb_build_object('count', v_stale_real_profiles,'status', CASE WHEN v_stale_real_profiles = 0 THEN 'pass' ELSE 'warn' END),
      'negative_credits',         jsonb_build_object('count', v_negative_credits,  'status', CASE WHEN v_negative_credits = 0  THEN 'pass' ELSE 'fail' END),
      'expired_evaluations',      jsonb_build_object('count', v_expired_evals,     'status', CASE WHEN v_expired_evals = 0     THEN 'pass' ELSE 'warn' END)
    ),
    'overall', CASE
      WHEN v_negative_credits > 0 THEN 'fail'
      WHEN v_null_enriched > 0 OR v_stale_real_profiles > 0 OR v_expired_evals > 0 THEN 'warn'
      ELSE 'pass'
    END
  );

  -- FIXED: use admin_user_id not user_id
  INSERT INTO admin_audit_log(action, admin_user_id, details)
  VALUES ('system_integrity_audit', '00000000-0000-0000-0000-000000000001'::uuid, result);

  RETURN result;
END;
$$;
