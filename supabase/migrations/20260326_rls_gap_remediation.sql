-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260326_rls_gap_remediation.sql
-- Purpose : Enable RLS on bot_signal_weights and discovery_runs tables which
--           were created without it, closing a Phase 4 DB integrity gap.
--
-- bot_signal_weights  — global ML tuning table; authenticated users can read
--                       weights for scoring display; only service_role writes.
-- discovery_runs      — internal cron audit log; only admins/service_role can
--                       read or write. No user-facing access needed.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── bot_signal_weights ───────────────────────────────────────────────────────
ALTER TABLE public.bot_signal_weights ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read signal weights (needed for bot score breakdown UI)
CREATE POLICY "bot_signal_weights_read" ON public.bot_signal_weights
  FOR SELECT TO authenticated USING (true);

-- Only service_role (edge functions, pg_cron) may insert or update weights.
-- No explicit INSERT/UPDATE policy = denied for all authenticated roles.

-- ── discovery_runs ───────────────────────────────────────────────────────────
ALTER TABLE public.discovery_runs ENABLE ROW LEVEL SECURITY;

-- Only admins (role = 'admin' in user_roles) may read the audit log.
CREATE POLICY "discovery_runs_admin_read" ON public.discovery_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  );

-- Service_role (cron workers) may insert run records — no RLS restriction applies
-- to service_role (it bypasses RLS by design).
