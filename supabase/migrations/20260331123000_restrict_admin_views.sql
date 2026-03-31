-- =============================================================================
-- Migration: 20260331_restrict_admin_views.sql
-- Purpose  : Revoke broad `authenticated` access to admin-only and dashboard
--            views that were inadvertently granted to all logged-in users in
--            previous migrations. Access is restricted to service_role only.
--
-- Affected views (created in previous migrations):
--   super_admin_user_overview      (20260330_super_admin_platform_hardening.sql)
--   super_admin_workspace_overview (20260330_super_admin_platform_hardening.sql)
--   super_admin_system_health      (20260330_super_admin_platform_hardening.sql)
--   dashboard_requests_per_minute  (20260329_production_readiness_guards.sql)
--   dashboard_error_rates          (20260329_production_readiness_guards.sql)
--   dashboard_credit_burn_rate     (20260329_production_readiness_guards.sql)
--   dashboard_job_queue_sizes      (20260329_production_readiness_guards.sql)
--
-- Security impact:
--   BEFORE: Any authenticated user could SELECT all platform user emails, roles,
--           credit balances, security event counts, and platform-wide API stats.
--   AFTER : Only service_role (used by edge functions via privileged_gateway.ts)
--           can read these views. The admin UI continues to work because all
--           admin pages route through edge functions that use the service role
--           client — no frontend changes are required.
--
-- Rollback: Re-grant `authenticated` on any view below if needed (not recommended).
-- Idempotent: REVOKE is safe to re-run; revoke of a privilege that doesn't exist
--             is a no-op in PostgreSQL (with IF EXISTS not required for REVOKE).
-- =============================================================================

-- H-01: Revoke broad authenticated access to super-admin overview views.
-- These contain platform-wide user emails, roles, and security event counts.
REVOKE SELECT ON public.super_admin_user_overview      FROM authenticated;
REVOKE SELECT ON public.super_admin_workspace_overview FROM authenticated;
REVOKE SELECT ON public.super_admin_system_health      FROM authenticated;

-- M-03: Revoke broad authenticated access to dashboard analytics views.
-- These contain platform-wide API usage rates, error rates, and credit burn data.
REVOKE SELECT ON public.dashboard_requests_per_minute  FROM authenticated;
REVOKE SELECT ON public.dashboard_error_rates          FROM authenticated;
REVOKE SELECT ON public.dashboard_credit_burn_rate     FROM authenticated;
REVOKE SELECT ON public.dashboard_job_queue_sizes      FROM authenticated;

-- service_role retains access — used by privileged edge functions.
-- No grant needed as service_role bypasses RLS and already has access.
-- Explicitly confirming for documentation clarity:
GRANT SELECT ON public.super_admin_user_overview      TO service_role;
GRANT SELECT ON public.super_admin_workspace_overview TO service_role;
GRANT SELECT ON public.super_admin_system_health      TO service_role;
GRANT SELECT ON public.dashboard_requests_per_minute  TO service_role;
GRANT SELECT ON public.dashboard_error_rates          TO service_role;
GRANT SELECT ON public.dashboard_credit_burn_rate     TO service_role;
GRANT SELECT ON public.dashboard_job_queue_sizes      TO service_role;
