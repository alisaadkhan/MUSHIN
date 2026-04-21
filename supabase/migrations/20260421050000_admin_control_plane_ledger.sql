-- ============================================================
-- MUSHIN — Admin Control Plane (Ledger-only Credits + Security)
-- Migration: 20260421050000_admin_control_plane_ledger.sql
--
-- Goals:
--   - Admin credit adjustments must be ledger-only (no direct balance counters)
--   - Provide admin/support views for credit ledger + security flags
-- ============================================================

-- 1) Admin RPC: mutate user credits via ledger (grant/consume)
--    NOTE: consume_user_credits/grant_user_credits are service_role-only by default,
--    so this RPC is SECURITY DEFINER and does its own role checks.
CREATE OR REPLACE FUNCTION public.admin_mutate_user_credits_ledger(
  p_target_user_id    uuid,
  p_workspace_id      uuid,
  p_credit_type       public.mushin_credit_type,
  p_mode              text,         -- 'adjust' | 'set'
  p_delta             integer DEFAULT NULL,
  p_new_balance       integer DEFAULT NULL,
  p_reason            text DEFAULT NULL,
  p_actor_user_id     uuid DEFAULT NULL,
  p_idempotency_key   text DEFAULT NULL,
  p_metadata          jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_before integer;
  v_after integer;
  v_effective_delta integer;
  v_action text;
  v_res jsonb;
BEGIN
  v_actor := COALESCE(p_actor_user_id, auth.uid());

  IF v_actor IS NULL OR NOT public.is_system_admin(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL OR p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id and workspace_id required' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode NOT IN ('adjust','set') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode = 'adjust' AND (p_delta IS NULL OR p_delta = 0) THEN
    RAISE EXCEPTION 'invalid_delta' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode = 'set' AND (p_new_balance IS NULL OR p_new_balance < 0) THEN
    RAISE EXCEPTION 'invalid_new_balance' USING ERRCODE = 'P0001';
  END IF;

  v_before := public.get_user_credit_balance(p_target_user_id, p_workspace_id, p_credit_type);

  IF p_mode = 'set' THEN
    v_after := p_new_balance;
    v_effective_delta := v_after - v_before;
  ELSE
    v_after := GREATEST(0, v_before + p_delta);
    v_effective_delta := v_after - v_before;
  END IF;

  IF v_effective_delta = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'noop', true,
      'balance_before', v_before,
      'balance_after', v_before
    );
  END IF;

  v_action := CASE
    WHEN v_effective_delta > 0 THEN 'admin_credit_adjustment'
    ELSE 'admin_credit_debit'
  END;

  IF v_effective_delta > 0 THEN
    v_res := public.grant_user_credits(
      p_user_id := p_target_user_id,
      p_workspace_id := p_workspace_id,
      p_credit_type := p_credit_type,
      p_amount := v_effective_delta,
      p_action := v_action,
      p_idempotency_key := p_idempotency_key,
      p_metadata := jsonb_build_object(
        'reason', p_reason,
        'actor_user_id', v_actor,
        'mode', p_mode,
        'delta', v_effective_delta
      ) || COALESCE(p_metadata, '{}'::jsonb)
    );
  ELSE
    v_res := public.consume_user_credits(
      p_user_id := p_target_user_id,
      p_workspace_id := p_workspace_id,
      p_credit_type := p_credit_type,
      p_amount := ABS(v_effective_delta),
      p_action := v_action,
      p_idempotency_key := p_idempotency_key,
      p_metadata := jsonb_build_object(
        'reason', p_reason,
        'actor_user_id', v_actor,
        'mode', p_mode,
        'delta', v_effective_delta
      ) || COALESCE(p_metadata, '{}'::jsonb)
    );
    IF (v_res->>'success')::boolean IS DISTINCT FROM true THEN
      -- convert to auth/edge-friendly insufficient credits
      RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'balance_before', v_before,
    'balance_after', v_after,
    'delta', v_effective_delta,
    'result', v_res
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mutate_user_credits_ledger(uuid, uuid, public.mushin_credit_type, text, integer, integer, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mutate_user_credits_ledger(uuid, uuid, public.mushin_credit_type, text, integer, integer, text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mutate_user_credits_ledger(uuid, uuid, public.mushin_credit_type, text, integer, integer, text, uuid, text, jsonb) TO service_role;

-- 2) Admin view: credit ledger (read-only)
CREATE OR REPLACE VIEW public.admin_credit_ledger_view
  WITH (security_invoker = true)
AS
SELECT
  ct.id,
  ct.created_at,
  ct.user_id,
  ct.workspace_id,
  ct.credit_type,
  ct.kind,
  ct.amount,
  ct.balance_before,
  ct.balance_after,
  ct.action,
  ct.idempotency_key,
  ct.metadata
FROM public.credit_transactions ct
WHERE public.is_system_admin(auth.uid());

REVOKE ALL ON public.admin_credit_ledger_view FROM PUBLIC;
GRANT SELECT ON public.admin_credit_ledger_view TO authenticated, service_role;

-- 3) Security alerts table (lightweight flags surface)
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  category text NOT NULL, -- e.g. 'rate_limit','credit_spike','api_abuse','auth'
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Backward compatible: if table existed from older migrations, ensure required columns exist
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS severity text;
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_alerts_select_support_admin ON public.security_alerts;
CREATE POLICY security_alerts_select_support_admin ON public.security_alerts
  FOR SELECT
  USING (public.is_support_or_admin() OR public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS security_alerts_insert_service_role ON public.security_alerts;
CREATE POLICY security_alerts_insert_service_role ON public.security_alerts
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

REVOKE UPDATE, DELETE ON public.security_alerts FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON public.security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_workspace ON public.security_alerts(workspace_id);

