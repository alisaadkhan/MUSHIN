-- ============================================================
-- MUSHIN — User Credit System (Balances + Transactions)
-- Migration: 20260421020000_user_credit_system.sql
--
-- Goal:
--   - user_credits: current balances (per user + workspace + credit_type)
--   - credit_transactions: immutable history (debits/credits)
--   - atomic RPC: consume_user_credits(...) for edge functions
--   - strengthen search_queries_log.workspace_id (FK + indexing)
--
-- Notes:
--   This migration co-exists with the older workspace counters / credit_ledger.
--   The new tables are the source of truth for the rebuilt AI/Search credit module.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) Types
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mushin_credit_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.mushin_credit_type AS ENUM ('ai', 'search', 'enrichment');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mushin_credit_tx_kind' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.mushin_credit_tx_kind AS ENUM ('debit', 'credit');
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2) user_credits (balances)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_credits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  credit_type   public.mushin_credit_type NOT NULL,
  balance       integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, credit_type)
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user_ws_type
  ON public.user_credits (user_id, workspace_id, credit_type);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Service role has full access (edge functions)
DROP POLICY IF EXISTS "service_role_all_user_credits" ON public.user_credits;
CREATE POLICY "service_role_all_user_credits" ON public.user_credits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can read their own balances for workspaces they belong to
DROP POLICY IF EXISTS "user_read_own_credits" ON public.user_credits;
CREATE POLICY "user_read_own_credits" ON public.user_credits
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = user_credits.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- No direct client-side writes by default (no INSERT/UPDATE/DELETE policies).

-- Keep updated_at fresh on update
CREATE OR REPLACE FUNCTION public.touch_user_credits_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_user_credits ON public.user_credits;
CREATE TRIGGER trg_touch_user_credits
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_credits_updated_at();

-- ────────────────────────────────────────────────────────────
-- 3) credit_transactions (immutable history)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  credit_type      public.mushin_credit_type NOT NULL,
  kind             public.mushin_credit_tx_kind NOT NULL,
  amount           integer NOT NULL CHECK (amount > 0),
  balance_before   integer NOT NULL CHECK (balance_before >= 0),
  balance_after    integer NOT NULL CHECK (balance_after >= 0),
  action           text NOT NULL,              -- e.g. 'osint_search', 'admin_grant', 'refund'
  idempotency_key  text,                       -- optional, for safe retries
  metadata         jsonb NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, credit_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created
  ON public.credit_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_ws_created
  ON public.credit_transactions (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type_created
  ON public.credit_transactions (credit_type, created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_credit_transactions" ON public.credit_transactions;
CREATE POLICY "service_role_all_credit_transactions" ON public.credit_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "user_read_own_credit_transactions" ON public.credit_transactions;
CREATE POLICY "user_read_own_credit_transactions" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = credit_transactions.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- No direct client-side writes by default.

-- ────────────────────────────────────────────────────────────
-- 4) Atomic RPC: consume_user_credits (debit) + grant_user_credits (credit)
-- ────────────────────────────────────────────────────────────
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
AS $$
DECLARE
  v_row           public.user_credits;
  v_before        integer;
  v_after         integer;
  v_existing_tx   uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be a positive integer';
  END IF;
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'action is required';
  END IF;

  -- Fast idempotency: if key provided and tx already exists, return it.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_tx
    FROM public.credit_transactions
    WHERE user_id = p_user_id
      AND workspace_id = p_workspace_id
      AND credit_type = p_credit_type
      AND idempotency_key = p_idempotency_key;
    IF v_existing_tx IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'transaction_id', v_existing_tx);
    END IF;
  END IF;

  -- Prevent concurrent overdrafts per (user, workspace, type)
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_workspace_id::text || ':' || p_credit_type::text));

  -- Ensure balance row exists
  INSERT INTO public.user_credits (user_id, workspace_id, credit_type, balance)
  VALUES (p_user_id, p_workspace_id, p_credit_type, 0)
  ON CONFLICT (user_id, workspace_id, credit_type) DO NOTHING;

  SELECT * INTO v_row
  FROM public.user_credits
  WHERE user_id = p_user_id
    AND workspace_id = p_workspace_id
    AND credit_type = p_credit_type
  FOR UPDATE;

  v_before := COALESCE(v_row.balance, 0);
  IF v_before < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_before,
      'required', p_amount
    );
  END IF;

  v_after := v_before - p_amount;

  UPDATE public.user_credits
  SET balance = v_after
  WHERE id = v_row.id;

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
AS $$
DECLARE
  v_row           public.user_credits;
  v_before        integer;
  v_after         integer;
  v_existing_tx   uuid;
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
      AND idempotency_key = p_idempotency_key;
    IF v_existing_tx IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'idempotent', true, 'transaction_id', v_existing_tx);
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_workspace_id::text || ':' || p_credit_type::text));

  INSERT INTO public.user_credits (user_id, workspace_id, credit_type, balance)
  VALUES (p_user_id, p_workspace_id, p_credit_type, 0)
  ON CONFLICT (user_id, workspace_id, credit_type) DO NOTHING;

  SELECT * INTO v_row
  FROM public.user_credits
  WHERE user_id = p_user_id
    AND workspace_id = p_workspace_id
    AND credit_type = p_credit_type
  FOR UPDATE;

  v_before := COALESCE(v_row.balance, 0);
  v_after := v_before + p_amount;

  UPDATE public.user_credits
  SET balance = v_after
  WHERE id = v_row.id;

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

-- Lock down: callable only by service role (edge) + system admins if desired.
REVOKE ALL ON FUNCTION public.consume_user_credits(uuid, uuid, public.mushin_credit_type, integer, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_user_credits(uuid, uuid, public.mushin_credit_type, integer, text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_user_credits(uuid, uuid, public.mushin_credit_type, integer, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_user_credits(uuid, uuid, public.mushin_credit_type, integer, text, text, jsonb) TO service_role;

-- If you want system admins to be able to grant credits from the SQL editor via authenticated JWT:
-- GRANT EXECUTE ON FUNCTION public.grant_user_credits(...) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 5) search_queries_log workspace_id hardening (if missing / not constrained)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.search_queries_log
  ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- Add FK (non-blocking for existing rows) and validate afterwards when clean.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'search_queries_log_workspace_id_fkey'
      AND conrelid = 'public.search_queries_log'::regclass
  ) THEN
    ALTER TABLE public.search_queries_log
      ADD CONSTRAINT search_queries_log_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sql_workspace_id ON public.search_queries_log (workspace_id);

