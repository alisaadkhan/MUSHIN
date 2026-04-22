-- Support RBAC tiers + feature flags (idempotent)
-- Tiers: L1, L2, admin_support (plus admin/super_admin/system_admin)
-- This is intentionally separate from billing/admin roles.

-- NOTE: `public.support_staff` already exists in this project as the employee/staff directory.
-- We use a separate table for RBAC tiers/flags to avoid schema conflicts.
CREATE TABLE IF NOT EXISTS public.support_staff_rbac (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'L1' CHECK (tier IN ('L1', 'L2', 'admin_support')),
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_staff_rbac ENABLE ROW LEVEL SECURITY;

-- Only admins can manage support_staff_rbac rows
DROP POLICY IF EXISTS ssr_admin_all ON public.support_staff_rbac;
CREATE POLICY ssr_admin_all ON public.support_staff_rbac
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.revoked_at IS NULL
        AND ur.role IN ('admin', 'super_admin', 'system_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.revoked_at IS NULL
        AND ur.role IN ('admin', 'super_admin', 'system_admin')
    )
  );

-- Support staff can read only their own tier/flags
DROP POLICY IF EXISTS ssr_self_read ON public.support_staff_rbac;
CREATE POLICY ssr_self_read ON public.support_staff_rbac
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Simple updated_at trigger (only if function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_support_staff_rbac_updated_at ON public.support_staff_rbac;
    CREATE TRIGGER trg_support_staff_rbac_updated_at
      BEFORE UPDATE ON public.support_staff_rbac
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Helper: current support tier (NULL if not support)
CREATE OR REPLACE FUNCTION public.get_my_support_tier()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ss.tier
  FROM public.support_staff_rbac ss
  WHERE ss.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_support_tier FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_support_tier TO authenticated;

-- Helper: support permissions resolved from tier + flags
-- Note: flags is an override layer (admins can enable/disable per user).
CREATE OR REPLACE FUNCTION public.get_my_support_permissions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_tier text;
  v_flags jsonb;
  v_base jsonb;
BEGIN
  -- Full access for admins (still audited at app level)
  SELECT ur.role INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.revoked_at IS NULL
  ORDER BY ur.created_at DESC
  LIMIT 1;

  IF v_role IN ('admin', 'super_admin', 'system_admin') THEN
    RETURN jsonb_build_object(
      'tier', 'admin_support',
      'canUserLookup', true,
      'canViewTickets', true,
      'canAssignTickets', true,
      'canWriteInternalNotes', true,
      'canViewActivityLogs', true,
      'canViewSessions', true,
      'canViewBilling', true,
      'canApplyCredits', true,
      'canImpersonate', true
    );
  END IF;

  SELECT ss.tier, ss.flags INTO v_tier, v_flags
  FROM public.support_staff_rbac ss
  WHERE ss.user_id = auth.uid();

  IF v_tier IS NULL THEN
    RETURN jsonb_build_object('tier', null);
  END IF;

  -- Tier baselines (default deny beyond L1)
  IF v_tier = 'L1' THEN
    v_base := jsonb_build_object(
      'tier', 'L1',
      'canUserLookup', true,
      'canViewTickets', true,
      'canAssignTickets', false,
      'canWriteInternalNotes', true,
      'canViewActivityLogs', true,
      'canViewSessions', false,
      'canViewBilling', true,
      'canApplyCredits', false,
      'canImpersonate', false
    );
  ELSIF v_tier = 'L2' THEN
    v_base := jsonb_build_object(
      'tier', 'L2',
      'canUserLookup', true,
      'canViewTickets', true,
      'canAssignTickets', true,
      'canWriteInternalNotes', true,
      'canViewActivityLogs', true,
      'canViewSessions', true,
      'canViewBilling', true,
      'canApplyCredits', false,
      'canImpersonate', false
    );
  ELSE
    v_base := jsonb_build_object(
      'tier', 'admin_support',
      'canUserLookup', true,
      'canViewTickets', true,
      'canAssignTickets', true,
      'canWriteInternalNotes', true,
      'canViewActivityLogs', true,
      'canViewSessions', true,
      'canViewBilling', true,
      'canApplyCredits', true,
      'canImpersonate', true
    );
  END IF;

  -- Merge overrides: flags keys overwrite base keys
  RETURN v_base || COALESCE(v_flags, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_support_permissions FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_support_permissions TO authenticated;

