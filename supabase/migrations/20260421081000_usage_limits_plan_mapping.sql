-- ============================================================
-- MUSHIN — Usage limits mapping (3 paid plans)
-- Migration: 20260421081000_usage_limits_plan_mapping.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_usage_limits_from_subscription(
  p_user_id   uuid,
  p_plan_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit bigint;
BEGIN
  -- Map plan name to monthly search limit (legacy usage_limits only).
  -- Credits are enforced by the ledger; this is for support dashboards and
  -- any remaining quota UI that still relies on usage_limits.
  v_limit := CASE p_plan_name
    WHEN 'pro'        THEN 500
    WHEN 'business'   THEN 2000
    WHEN 'enterprise' THEN 10000
    ELSE 0
  END;

  INSERT INTO public.usage_limits (user_id, monthly_limit)
  VALUES (p_user_id, v_limit)
  ON CONFLICT (user_id) DO UPDATE
    SET monthly_limit = v_limit,
        updated_at    = now();
END;
$$;

REVOKE ALL ON FUNCTION public.sync_usage_limits_from_subscription(uuid, text) FROM anon, authenticated;

