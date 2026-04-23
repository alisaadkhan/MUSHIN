-- ============================================================================
-- Support impersonation sessions (tracked + time-limited)
-- Migration: 20260422252000_impersonation_sessions.sql
--
-- Why:
-- - Controlled impersonation must be auditable and time-limited.
-- - We cannot revoke individual access tokens in Supabase, but we can:
--   - track active impersonation windows
--   - show UI banners + admin oversight
--   - terminate by invalidating refresh tokens (ends future refresh)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_reason text
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active
  ON public.impersonation_sessions(expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target
  ON public.impersonation_sessions(target_user_id, created_at DESC);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Only super admins can read all sessions (oversight).
DROP POLICY IF EXISTS impersonation_sessions_super_admin_read ON public.impersonation_sessions;
CREATE POLICY impersonation_sessions_super_admin_read ON public.impersonation_sessions
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Support staff cannot browse sessions directly; edge functions use service role.
REVOKE ALL ON public.impersonation_sessions FROM PUBLIC;

-- Prevent updates/deletes from clients.
REVOKE UPDATE, DELETE ON public.impersonation_sessions FROM anon, authenticated;

COMMIT;

