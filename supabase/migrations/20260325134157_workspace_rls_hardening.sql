-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- WORKSPACE RLS HARDENING â€” Pentest Remediation Phase 5 + Phase 8
-- Applied: 2026-03-12
--
-- Phase 5 â€” Fix RLS Data Exposure:
--   follower_history, audience_analysis, linked_accounts
--   Restrict SELECT to workspace members only (true workspace isolation).
--   Prior policies used auth.uid() IS NOT NULL (any authenticated user could read
--   enrichment data from ALL workspaces, leaking competitor intelligence).
--
-- Phase 8 â€” Optional Encryption preparation:
--   Enable pgcrypto extension so future migrations can call pgp_sym_encrypt /
--   pgp_sym_decrypt for workspace_secrets API keys.
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Phase 8: Enable pgcrypto for future secret encryption
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Phase 5a: follower_history â€” true workspace isolation
--
-- follower_history has no direct workspace_id FK. Because it acts as a shared
-- enrichment cache, we require the calling user to be a member of at least one
-- active workspace. Purely anonymous or unaffiliated reads are blocked.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.follower_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fh_member_select"                          ON public.follower_history;
DROP POLICY IF EXISTS "fh_service_write"                          ON public.follower_history;
DROP POLICY IF EXISTS "Workspace members can read follower history" ON public.follower_history;
DROP POLICY IF EXISTS "Service role manages follower history"       ON public.follower_history;
-- SELECT: restrict to callers who are in a workspace
DROP POLICY IF EXISTS "fh_workspace_select" ON public.follower_history;
CREATE POLICY "fh_workspace_select" ON public.follower_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );
-- ALL writes go through service_role only (enrich-influencer edge function)
DROP POLICY IF EXISTS "fh_service_write" ON public.follower_history;
CREATE POLICY "fh_service_write" ON public.follower_history
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Phase 5b: audience_analysis â€” workspace-scoped SELECT
--
-- Shared enrichment cache logic as above.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.audience_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aa_member_select"                          ON public.audience_analysis;
DROP POLICY IF EXISTS "aa_service_write"                          ON public.audience_analysis;
DROP POLICY IF EXISTS "Authenticated can read audience analysis"  ON public.audience_analysis;
DROP POLICY IF EXISTS "Service role manages audience analysis"    ON public.audience_analysis;
DROP POLICY IF EXISTS "Users can read audience analysis"          ON public.audience_analysis;
-- SELECT: restrict to callers who are in a workspace
DROP POLICY IF EXISTS "aa_workspace_select" ON public.audience_analysis;
CREATE POLICY "aa_workspace_select" ON public.audience_analysis
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "aa_service_write" ON public.audience_analysis;
CREATE POLICY "aa_service_write" ON public.audience_analysis
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Phase 5c: linked_accounts â€” workspace-scoped SELECT
--
-- Shared enrichment cache logic as above.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "la_member_select"                        ON public.linked_accounts;
DROP POLICY IF EXISTS "la_service_write"                        ON public.linked_accounts;
DROP POLICY IF EXISTS "Authenticated can read linked accounts"  ON public.linked_accounts;
DROP POLICY IF EXISTS "Service role manages linked accounts"    ON public.linked_accounts;
-- SELECT: restrict to callers who are in a workspace
DROP POLICY IF EXISTS "la_workspace_select" ON public.linked_accounts;
CREATE POLICY "la_workspace_select" ON public.linked_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "la_service_write" ON public.linked_accounts;
CREATE POLICY "la_service_write" ON public.linked_accounts
  FOR ALL
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Phase 5d: Explicit UPDATE policies enforcing workspace isolation
--
-- Authenticated users should never be able to UPDATE enrichment cache tables
-- directly â€” all mutations must go through service_role edge functions.
-- The service_write policies above already cover UPDATE via FOR ALL, but we
-- add explicit DROP of any legacy unrestricted UPDATE policies here to be safe.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Ensure no stale UPDATE-only policies exist that could bypass the above
DROP POLICY IF EXISTS "Allow update follower history"   ON public.follower_history;
DROP POLICY IF EXISTS "Allow update audience analysis"  ON public.audience_analysis;
DROP POLICY IF EXISTS "Allow update linked accounts"    ON public.linked_accounts;
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Phase 6 (reinforcement): tracking_events â€” service_role INSERT only
--
-- Idempotent re-apply in case 20260324_pentest_fixes.sql has not been pushed
-- to this environment yet. These DROPs are safe even if the policies don't
-- exist.
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "te_public_insert" ON public.tracking_events;
-- Only the track-click edge function (service_role) may insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'tracking_events'
      AND policyname = 'te_service_insert'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "te_service_insert" ON public.tracking_events
        FOR INSERT
        WITH CHECK (auth.role() = 'service_role')
    $pol$;
  END IF;
END;
$$;
