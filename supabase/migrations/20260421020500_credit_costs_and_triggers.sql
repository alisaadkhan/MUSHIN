-- ============================================================
-- MUSHIN — Credit Costs + Automatic Debits (Campaigns/Saved Search/Email)
-- Migration: 20260421020500_credit_costs_and_triggers.sql
--
-- Adds:
--   - credit_costs: configurable pricing per action
--   - triggers to automatically debit credits on:
--       * campaigns insert
--       * saved_searches insert
--       * outreach_log insert (email only)
-- ============================================================

-- 1) Pricing table
CREATE TABLE IF NOT EXISTS public.credit_costs (
  action      text PRIMARY KEY,
  credit_type public.mushin_credit_type NOT NULL,
  amount      integer NOT NULL CHECK (amount >= 0),
  enabled     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;
-- Readable by authenticated users (to show pricing in UI)
DROP POLICY IF EXISTS "credit_costs_read" ON public.credit_costs;
CREATE POLICY "credit_costs_read" ON public.credit_costs
  FOR SELECT TO authenticated
  USING (true);
-- Writable only by service role by default
DROP POLICY IF EXISTS "credit_costs_service_write" ON public.credit_costs;
CREATE POLICY "credit_costs_service_write" ON public.credit_costs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
-- Default pricing (adjust any time)
INSERT INTO public.credit_costs (action, credit_type, amount, enabled)
VALUES
  ('campaign_create',     'search'::public.mushin_credit_type, 1, true),
  ('saved_search_create', 'search'::public.mushin_credit_type, 1, true),
  ('email_send',          'email'::public.mushin_credit_type,  1, true)
ON CONFLICT (action) DO NOTHING;
-- 2) Helper: fetch pricing row
CREATE OR REPLACE FUNCTION public.get_credit_cost(p_action text)
RETURNS TABLE(credit_type public.mushin_credit_type, amount integer, enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT c.credit_type, c.amount, c.enabled
  FROM public.credit_costs c
  WHERE c.action = p_action
  LIMIT 1;
$$;
-- 3) Helper: debit credits for current auth user (trigger-safe)
CREATE OR REPLACE FUNCTION public.debit_current_user_for_action(
  p_workspace_id uuid,
  p_action text,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_cost record;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();

  -- If the insert is performed by service role / internal jobs, don't debit here.
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'no_auth_uid');
  END IF;

  SELECT * INTO v_cost FROM public.get_credit_cost(p_action);
  IF v_cost IS NULL OR v_cost.enabled IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'cost_disabled');
  END IF;

  IF COALESCE(v_cost.amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', true, 'skipped', true, 'reason', 'zero_cost');
  END IF;

  v_result := public.consume_user_credits(
    p_user_id := v_user_id,
    p_workspace_id := p_workspace_id,
    p_credit_type := v_cost.credit_type,
    p_amount := v_cost.amount,
    p_action := p_action,
    p_idempotency_key := p_idempotency_key,
    p_metadata := COALESCE(p_metadata, '{}'::jsonb)
  );

  IF (v_result->>'success')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Insufficient credits for %', p_action USING ERRCODE = 'P0001';
  END IF;

  RETURN v_result;
END;
$$;
-- 5) Triggers

-- Campaign creation cost
CREATE OR REPLACE FUNCTION public.trg_debit_on_campaign_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.debit_current_user_for_action(
    p_workspace_id := NEW.workspace_id,
    p_action := 'campaign_create',
    p_idempotency_key := NEW.id::text,
    p_metadata := jsonb_build_object('campaign_id', NEW.id, 'name', NEW.name)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_campaign_create_debit ON public.campaigns;
CREATE TRIGGER trg_campaign_create_debit
  AFTER INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.trg_debit_on_campaign_create();
-- Saved search creation cost
CREATE OR REPLACE FUNCTION public.trg_debit_on_saved_search_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.debit_current_user_for_action(
    p_workspace_id := NEW.workspace_id,
    p_action := 'saved_search_create',
    p_idempotency_key := NEW.id::text,
    p_metadata := jsonb_build_object('saved_search_id', NEW.id, 'name', NEW.name)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_saved_search_create_debit ON public.saved_searches;
CREATE TRIGGER trg_saved_search_create_debit
  AFTER INSERT ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.trg_debit_on_saved_search_create();
-- Email outreach cost (only when an email-like outreach is inserted)
CREATE OR REPLACE FUNCTION public.trg_debit_on_outreach_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  -- Only charge if this entry is actually an email send/log.
  IF COALESCE(NEW.method, '') NOT IN ('email', 'gmail', 'sendgrid') AND NEW.email_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve workspace via campaign
  SELECT c.workspace_id INTO v_workspace_id
  FROM public.campaigns c
  WHERE c.id = NEW.campaign_id
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.debit_current_user_for_action(
    p_workspace_id := v_workspace_id,
    p_action := 'email_send',
    p_idempotency_key := NEW.id::text,
    p_metadata := jsonb_build_object(
      'outreach_id', NEW.id,
      'campaign_id', NEW.campaign_id,
      'to', NEW.email_to,
      'subject', NEW.email_subject
    )
  );

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_outreach_email_debit ON public.outreach_log;
CREATE TRIGGER trg_outreach_email_debit
  AFTER INSERT ON public.outreach_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_debit_on_outreach_email();
