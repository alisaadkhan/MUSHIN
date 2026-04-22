-- MUSHIN Advanced Analytics & Security Expansion

-- 1. Admin Control Expansion Flags
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT FALSE;
-- 2. Telemetry Tables
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    session_id TEXT,
    event_type TEXT NOT NULL, -- 'login', 'logout', 'session_start', 'session_end'
    ip_address TEXT,
    geo_location JSONB, -- country, city
    user_agent TEXT,
    duration_seconds INTEGER,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    endpoint TEXT NOT NULL,
    request_id TEXT,
    latency_ms INTEGER,
    status_code INTEGER,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Indexing for Dashboard Performance
CREATE INDEX IF NOT EXISTS idx_user_activity_user_ts ON public.user_activity_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint_ts ON public.api_usage_logs(endpoint, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_workspace ON public.api_usage_logs(workspace_id);
-- 3. Idempotent Refunds
CREATE TABLE IF NOT EXISTS public.refund_idempotency_keys (
    idempotency_key TEXT PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    refund_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Update restore_ai_credit to support idempotency natively
CREATE OR REPLACE FUNCTION public.restore_ai_credit(ws_id UUID, i_key TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cur_plan TEXT;
BEGIN
    IF i_key IS NOT NULL THEN
        -- Atomic insert will raise unique violation exception if idempotency key exists
        INSERT INTO public.refund_idempotency_keys (idempotency_key, workspace_id, refund_type)
        VALUES (i_key, ws_id, 'ai');
    END IF;

    SELECT plan INTO cur_plan FROM public.subscriptions WHERE workspace_id = ws_id AND status = 'active';
    -- Unlimited plans do not get credit refunds
    IF cur_plan = 'enterprise' OR cur_plan = 'unlimited' THEN
        RETURN;
    END IF;

    UPDATE public.workspaces
    SET ai_credits_remaining = ai_credits_remaining + 1
    WHERE id = ws_id;
END;
$$;
-- Update restore_email_credit to support idempotency
CREATE OR REPLACE FUNCTION public.restore_email_credit(ws_id UUID, i_key TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cur_plan TEXT;
BEGIN
    IF i_key IS NOT NULL THEN
        -- Atomic insert will raise unique violation exception if idempotency key exists
        INSERT INTO public.refund_idempotency_keys (idempotency_key, workspace_id, refund_type)
        VALUES (i_key, ws_id, 'email');
    END IF;

    SELECT plan INTO cur_plan FROM public.subscriptions WHERE workspace_id = ws_id AND status = 'active';
    IF cur_plan = 'enterprise' OR cur_plan = 'unlimited' THEN
        RETURN;
    END IF;

    UPDATE public.workspaces
    SET email_sends_remaining = email_sends_remaining + 1
    WHERE id = ws_id;
END;
$$;
-- 4. RLS Policies
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_idempotency_keys ENABLE ROW LEVEL SECURITY;
-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access user_activity" ON public.user_activity_logs;
DROP POLICY IF EXISTS "Service role full access api_usage" ON public.api_usage_logs;
DROP POLICY IF EXISTS "Service role full access idempotency" ON public.refund_idempotency_keys;
CREATE POLICY "Service role full access user_activity" ON public.user_activity_logs FOR ALL USING (true);
CREATE POLICY "Service role full access api_usage" ON public.api_usage_logs FOR ALL USING (true);
CREATE POLICY "Service role full access idempotency" ON public.refund_idempotency_keys FOR ALL USING (true);
-- System admins can read telemetry
DROP POLICY IF EXISTS "System admins can read user_activity" ON public.user_activity_logs;
DROP POLICY IF EXISTS "System admins can read api_usage" ON public.api_usage_logs;
CREATE POLICY "System admins can read user_activity" ON public.user_activity_logs FOR SELECT USING (public.is_system_admin(auth.uid()));
CREATE POLICY "System admins can read api_usage" ON public.api_usage_logs FOR SELECT USING (public.is_system_admin(auth.uid()));
-- 5. Data Retention pruning via pg_cron
-- Remove older user activity (90 days) and api usage (30 days) to prevent bloat
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $do$
BEGIN
    -- Delete older analytics daily at 3 AM UTC
    PERFORM cron.schedule('prune_user_activity', '0 3 * * *', $job$
        DELETE FROM public.user_activity_logs WHERE timestamp < NOW() - INTERVAL '90 days';
    $job$);

    PERFORM cron.schedule('prune_api_usage', '0 4 * * *', $job$
        DELETE FROM public.api_usage_logs WHERE timestamp < NOW() - INTERVAL '30 days';
    $job$);

    PERFORM cron.schedule('prune_idempotency_keys', '0 5 * * *', $job$
        DELETE FROM public.refund_idempotency_keys WHERE created_at < NOW() - INTERVAL '30 days';
    $job$);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $do$;
