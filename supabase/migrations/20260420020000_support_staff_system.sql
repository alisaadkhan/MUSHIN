-- ============================================================
-- Migration: 20260420020000_support_staff_system.sql
-- Creates support role, dedicated tables, and RLS policies
-- for the support staff module.
-- ORDER: enums → tables → functions → views → policies → indexes
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. Extend user_roles to accept 'support' role
-- ────────────────────────────────────────────────
DO $$
BEGIN
  -- Add 'support' to the existing role enum if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'support'
    AND enumtypid = (
      SELECT oid FROM pg_type WHERE typname = 'app_role'
    )
  ) THEN
    ALTER TYPE app_role ADD VALUE 'support';
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- app_role type doesn't exist as enum; roles stored as text — no action needed
    NULL;
END $$;

-- ────────────────────────────────────────────────
-- 2. Support audit log — every support action is logged
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_actions_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        text NOT NULL,          -- e.g. 'view_user', 'view_subscription'
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_actions_log ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────
-- 3. Helper function (must come before any view/policy that uses it)
-- ────────────────────────────────────────────────

-- is_support_or_admin: used by policies and the email lookup function
CREATE OR REPLACE FUNCTION public.is_support_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('support', 'admin', 'super_admin')
  );
$$;

-- get_user_email_safe: SECURITY DEFINER — queries auth.users safely
-- Must be defined BEFORE the view that calls it.
CREATE OR REPLACE FUNCTION public.get_user_email_safe(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  -- Only callable by support/admin
  IF NOT public.is_support_or_admin() THEN
    RETURN NULL;
  END IF;

  SELECT email INTO v_email
  FROM auth.users
  WHERE id = target_user_id;

  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_email_safe FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_email_safe TO authenticated;

-- ────────────────────────────────────────────────
-- 4. Support view — safe, read-only user lookup
--    Defined AFTER the functions it depends on.
--    Uses SECURITY INVOKER so underlying table RLS applies.
-- ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.support_user_view
  WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  p.onboarding_completed,
  p.created_at,
  -- Email via SECURITY DEFINER function (defined above)
  public.get_user_email_safe(p.id) AS email,
  -- Subscription tier — left join in case table doesn't exist yet
  COALESCE(ul.search_count, 0)  AS search_count,
  COALESCE(ul.monthly_limit, 50) AS monthly_limit
FROM public.profiles p
LEFT JOIN public.usage_limits ul ON ul.user_id = p.id;

-- Revoke public access; grant to authenticated (RLS enforced via base tables)
REVOKE ALL ON public.support_user_view FROM anon, authenticated;
GRANT SELECT ON public.support_user_view TO authenticated;

-- ────────────────────────────────────────────────
-- 5. RPC for support: look up a user by email
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.support_lookup_user(p_email text)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  search_count bigint,
  monthly_limit bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_support_or_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    sv.id,
    sv.full_name,
    sv.email,
    sv.search_count,
    sv.monthly_limit,
    sv.created_at
  FROM public.support_user_view sv
  WHERE sv.email ILIKE p_email
  LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.support_lookup_user FROM anon;
GRANT EXECUTE ON FUNCTION public.support_lookup_user TO authenticated;

-- ────────────────────────────────────────────────
-- 6. RLS policies — support can READ user profiles
-- ────────────────────────────────────────────────

-- Audit log: support staff insert, admins+support read
DROP POLICY IF EXISTS "support_staff_insert_log" ON public.support_actions_log;
CREATE POLICY "support_staff_insert_log" ON public.support_actions_log
  FOR INSERT
  WITH CHECK (
    auth.uid() = support_id
    AND public.is_support_or_admin()
  );

DROP POLICY IF EXISTS "support_read_own_log" ON public.support_actions_log;
CREATE POLICY "support_read_own_log" ON public.support_actions_log
  FOR SELECT
  USING (
    auth.uid() = support_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
    )
  );

-- Allow support to SELECT profiles (for user lookup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'support_read_profiles'
    AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "support_read_profiles" ON public.profiles
      FOR SELECT
      USING (public.is_support_or_admin());
  END IF;
END $$;

-- Support can view subscriptions for context (read-only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'paddle_subscriptions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE policyname = 'support_read_subscriptions'
      AND tablename = 'paddle_subscriptions'
    ) THEN
      CREATE POLICY "support_read_subscriptions" ON public.paddle_subscriptions
        FOR SELECT
        USING (public.is_support_or_admin());
    END IF;
  END IF;
END $$;

-- ────────────────────────────────────────────────
-- 7. Indexes for performance
-- ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_support_actions_log_support_id
  ON public.support_actions_log(support_id);

CREATE INDEX IF NOT EXISTS idx_support_actions_log_target_user
  ON public.support_actions_log(target_user_id);

CREATE INDEX IF NOT EXISTS idx_support_actions_log_created_at
  ON public.support_actions_log(created_at DESC);
