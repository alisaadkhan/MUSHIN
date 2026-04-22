-- ============================================================
-- MUSHIN — Ledger-only Credits (single source of truth)
-- Migration: 20260421030000_ledger_only_credits.sql
--
-- Problem:
--   The app historically had multiple credit sources (workspace counters,
--   user_credits balance rows, and other ledgers), causing UI desync.
--
-- Fix:
--   Make `credit_transactions` the single source of truth (ledger).
--   Balance = SUM(credit) - SUM(debit) for (user_id, workspace_id, credit_type).
--
-- This migration:
--   - Creates a computed view for balances
--   - Adds RPC helpers for "my balances"
--   - Rewrites consume/grant RPCs to only append to ledger (no balance tables)
-- ============================================================

-- 1) Computed balances view (ledger-only)
CREATE OR REPLACE VIEW public.user_credit_balances AS
SELECT
  user_id,
  workspace_id,
  credit_type,
  GREATEST(
    0,
    COALESCE(SUM(
      CASE kind
        WHEN 'credit' THEN amount
        WHEN 'debit'  THEN -amount
        ELSE 0
      END
    ), 0)
  )::integer AS balance,
  MAX(created_at) AS last_event_at
FROM public.credit_transactions
GROUP BY user_id, workspace_id, credit_type;
-- 2) RPC: get my balances for a workspace (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_my_credit_balances(p_workspace_id uuid)
RETURNS TABLE(credit_type public.mushin_credit_type, balance integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.credit_type,
    b.balance
  FROM public.user_credit_balances b
  WHERE b.user_id = auth.uid()
    AND b.workspace_id = p_workspace_id
  ORDER BY b.credit_type::text;
$$;
REVOKE ALL ON FUNCTION public.get_my_credit_balances(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_credit_balances(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_credit_balances(uuid) TO service_role;
-- 3) Internal helper: get balance (for RPCs)
CREATE OR REPLACE FUNCTION public.get_user_credit_balance(
  p_user_id uuid,
  p_workspace_id uuid,
  p_credit_type public.mushin_credit_type
) RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT balance
    FROM public.user_credit_balances
    WHERE user_id = p_user_id
      AND workspace_id = p_workspace_id
      AND credit_type = p_credit_type
    LIMIT 1
  ), 0);
$$;
REVOKE ALL ON FUNCTION public.get_user_credit_balance(uuid, uuid, public.mushin_credit_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_credit_balance(uuid, uuid, public.mushin_credit_type) TO service_role;
-- 4) Rewrite consume/grant to append-only ledger
CREATE OR REPLACE FUNCTION public.consume_user_credits(
  p_user_id         uuid,
  p_workspace_id    uuid,
  p_credit_type     public.mushin_credit_type,
  p_amount          integer,
  p_action          text,
  p_idempotency_key text DEFAULT NULL,
  p_metadata        jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before integer;
  v_after integer;
  v_existing_tx uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be a positive integer';
  END IF;
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'action is required';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_tx
    FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND workspace_id = p_workspace_id
      AND credit_type = p_credit_type
      AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF v_existing_tx IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'transaction_id', v_existing_tx);
    END IF;
  END IF;

  -- Prevent concurrent overdrafts per (user, workspace, type)
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_workspace_id::text || ':' || p_credit_type::text));

  v_before := public.get_user_credit_balance(p_user_id, p_workspace_id, p_credit_type);
  IF v_before < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', v_before, 'required', p_amount);
  END IF;

  v_after := v_before - p_amount;

  INSERT INTO public.credit_transactions (
    user_id, workspace_id, credit_type,
    kind, amount, balance_before, balance_after,
    action, idempotency_key, metadata
  )
  VALUES (
    p_user_id, p_workspace_id, p_credit_type,
    'debit', p_amount, v_before, v_after,
    p_action, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_existing_tx;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_existing_tx,
    'balance_before', v_before,
    'balance_after', v_after
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.grant_user_credits(
  p_user_id         uuid,
  p_workspace_id    uuid,
  p_credit_type     public.mushin_credit_type,
  p_amount          integer,
  p_action          text,
  p_idempotency_key text DEFAULT NULL,
  p_metadata        jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before integer;
  v_after integer;
  v_existing_tx uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be a positive integer';
  END IF;
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'action is required';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_tx
    FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND workspace_id = p_workspace_id
      AND credit_type = p_credit_type
      AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF v_existing_tx IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'transaction_id', v_existing_tx);
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_workspace_id::text || ':' || p_credit_type::text));

  v_before := public.get_user_credit_balance(p_user_id, p_workspace_id, p_credit_type);
  v_after := v_before + p_amount;

  INSERT INTO public.credit_transactions (
    user_id, workspace_id, credit_type,
    kind, amount, balance_before, balance_after,
    action, idempotency_key, metadata
  )
  VALUES (
    p_user_id, p_workspace_id, p_credit_type,
    'credit', p_amount, v_before, v_after,
    p_action, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_existing_tx;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_existing_tx,
    'balance_before', v_before,
    'balance_after', v_after
  );
END;
$$;
-- Keep the same execution grants (service role only by default)
REVOKE ALL ON FUNCTION public.consume_user_credits(uuid, uuid, public.mushin_credit_type, integer, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_user_credits(uuid, uuid, public.mushin_credit_type, integer, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_user_credits(uuid, uuid, public.mushin_credit_type, integer, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_user_credits(uuid, uuid, public.mushin_credit_type, integer, text, text, jsonb) TO service_role;
