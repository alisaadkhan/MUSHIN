-- ============================================================
-- MUSHIN — Fix user_roles RLS recursion
-- Migration: 20260421180000_fix_user_roles_policies.sql
--
-- Problem:
--   Some environments ended up with a self-referential policy on `user_roles`
--   (EXISTS(SELECT ... FROM user_roles ...)) which can trigger:
--     "infinite recursion detected in policy for relation \"user_roles\""
--
-- Fix:
--   Enforce a minimal, non-recursive RLS posture:
--     - authenticated: can read ONLY their own role rows
--     - service_role: full access (edge functions / admin control plane)
-- ============================================================

ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  p record;
BEGIN
  -- Drop ALL existing policies on user_roles to eliminate recursion.
  FOR p IN
    SELECT polname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', p.polname);
  END LOOP;
END $$;

-- Self-read only
CREATE POLICY ur_self_select
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role full access
CREATE POLICY ur_service_write
  ON public.user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

