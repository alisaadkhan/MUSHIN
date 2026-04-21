-- ============================================================
-- Migration: 20260420_paddle_payment_system.sql
-- Creates Paddle subscription tables and webhook idempotency log.
-- Never stores raw card data — only subscription/status metadata.
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. paddle_subscriptions table
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paddle_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_subscription_id  text UNIQUE NOT NULL,
  paddle_customer_id      text NOT NULL,
  paddle_product_id       text,
  paddle_price_id         text,
  plan_name               text NOT NULL DEFAULT 'free',
  -- Status mirrors Paddle's subscription statuses
  -- active | trialing | past_due | canceled | paused
  status                  text NOT NULL DEFAULT 'active',
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  canceled_at             timestamptz,
  raw_paddle_data         jsonb DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paddle_status_values CHECK (
    status IN ('active', 'trialing', 'past_due', 'canceled', 'paused')
  )
);

ALTER TABLE public.paddle_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
CREATE POLICY "users_read_own_subscription" ON public.paddle_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- No direct inserts/updates from client — all writes go through Edge Functions
-- (service role key only)

-- ────────────────────────────────────────────────
-- 2. paddle_webhooks_log — idempotency table
--    Prevents double-processing of the same event
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.paddle_webhooks_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paddle_event_id   text UNIQUE NOT NULL,  -- Paddle's notification_id
  event_type        text NOT NULL,
  processed_at      timestamptz NOT NULL DEFAULT now(),
  payload           jsonb DEFAULT '{}',
  processing_error  text
);

ALTER TABLE public.paddle_webhooks_log ENABLE ROW LEVEL SECURITY;

-- No user access — only service role (Edge Functions)
-- Admins can read via their privileged role
CREATE POLICY "admin_read_webhook_log" ON public.paddle_webhooks_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ────────────────────────────────────────────────
-- 3. usage_limits table (if not already exists)
--    Tracks per-user monthly quota consumption
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_limits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_count    bigint NOT NULL DEFAULT 0,
  monthly_limit   bigint NOT NULL DEFAULT 50,  -- Free plan default
  period_start    timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  period_end      timestamptz NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  alert_50_sent   boolean NOT NULL DEFAULT false,
  alert_80_sent   boolean NOT NULL DEFAULT false,
  alert_100_sent  boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_usage" ON public.usage_limits
  FOR SELECT USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────
-- 4. Function: sync_usage_limits_from_subscription
--    Called after webhook updates subscription to update plan limits
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_usage_limits_from_subscription(
  p_user_id   uuid,
  p_plan_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit bigint;
BEGIN
  -- Map plan name to monthly search limit
  v_limit := CASE p_plan_name
    WHEN 'free'     THEN 50
    WHEN 'pro'      THEN 999999    -- Effectively unlimited
    WHEN 'business' THEN 999999
    ELSE 50
  END;

  INSERT INTO public.usage_limits (user_id, monthly_limit)
  VALUES (p_user_id, v_limit)
  ON CONFLICT (user_id) DO UPDATE
    SET monthly_limit = v_limit,
        updated_at    = now();
END;
$$;

REVOKE ALL ON FUNCTION public.sync_usage_limits_from_subscription FROM anon, authenticated;

-- ────────────────────────────────────────────────
-- 5. Function: reset_monthly_usage (called by cron)
--    Resets counters at the start of each billing period
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_monthly_usage_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.usage_limits
  SET
    search_count   = 0,
    period_start   = date_trunc('month', now()),
    period_end     = date_trunc('month', now()) + interval '1 month',
    alert_50_sent  = false,
    alert_80_sent  = false,
    alert_100_sent = false,
    updated_at     = now()
  WHERE user_id = p_user_id;
END;
$$;

-- ────────────────────────────────────────────────
-- 6. Indexes
-- ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_paddle_subs_user_id
  ON public.paddle_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_paddle_subs_status
  ON public.paddle_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_paddle_webhooks_event_id
  ON public.paddle_webhooks_log(paddle_event_id);

CREATE INDEX IF NOT EXISTS idx_usage_limits_user_id
  ON public.usage_limits(user_id);

-- ────────────────────────────────────────────────
-- 7. Auto-update timestamp trigger
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_paddle_subs_updated_at'
  ) THEN
    CREATE TRIGGER trg_paddle_subs_updated_at
      BEFORE UPDATE ON public.paddle_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
