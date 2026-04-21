-- ============================================================
-- MUSHIN — Force RLS on sensitive operational tables
-- Migration: 20260421120000_force_rls_sensitive_tables.sql
--
-- Goal:
--   Deny-by-default posture for billing, rate limits, and security telemetry.
--   Force RLS so even table owners don't accidentally bypass policies.
-- ============================================================

-- Billing / payments
ALTER TABLE IF EXISTS public.paddle_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.paddle_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.paddle_webhooks_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.paddle_webhooks_log FORCE ROW LEVEL SECURITY;

-- Rate limiting control plane
ALTER TABLE IF EXISTS public.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.api_rate_limits FORCE ROW LEVEL SECURITY;

-- Security telemetry
ALTER TABLE IF EXISTS public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_alerts FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_events FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.security_anomaly_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_anomaly_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.system_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_audit_logs FORCE ROW LEVEL SECURITY;

-- Credits ledger (sensitive financial-like data)
ALTER TABLE IF EXISTS public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_transactions FORCE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_credits FORCE ROW LEVEL SECURITY;

-- Secrets
ALTER TABLE IF EXISTS public.workspace_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspace_secrets FORCE ROW LEVEL SECURITY;

