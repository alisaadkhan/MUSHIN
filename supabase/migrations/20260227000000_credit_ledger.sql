-- ============================================================
-- MUSHIN — Credit Ledger Migration
-- Migration: 20260227000000_credit_ledger.sql
-- Strategy: Event-sourced. Balance = SUM(delta) per workspace.
--           No balance stored directly. All mutations append rows.
-- ============================================================

-- ── 1. Credit ledger table (append-only) ─────────────────────
CREATE TABLE IF NOT EXISTS credit_ledger (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  credit_type     text        NOT NULL CHECK (credit_type IN (
                                'search', 'ai', 'email', 'enrichment'
                              )),
  event_type      text        NOT NULL CHECK (event_type IN (
                                'purchase',       -- subscription allocation
                                'usage',          -- user consumed credits
                                'admin_adjust',   -- manual admin adjustment
                                'refund',         -- credit restored after refund
                                'expiry',         -- credits expired at cycle end
                                'rollover'        -- credits carried to next period
                              )),
  delta           integer     NOT NULL,  -- positive = credit in, negative = debit
  balance_after   integer     NOT NULL,  -- running balance snapshot (denormalised for speed)
  actor_user_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  note            text,
  metadata        jsonb       DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- Enforce append-only: no UPDATE or DELETE allowed via RLS
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
-- Admins can INSERT (append)
DROP POLICY IF EXISTS "admin_insert_ledger" ON credit_ledger;
CREATE POLICY "admin_insert_ledger" ON credit_ledger
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );
-- Anyone in a workspace can read their own ledger
DROP POLICY IF EXISTS "workspace_read_ledger" ON credit_ledger;
CREATE POLICY "workspace_read_ledger" ON credit_ledger
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'support')
    )
  );
-- No UPDATE or DELETE policies — effectively append-only
-- (No policies means the action is denied by default)

-- ── 2. Computed balance view ──────────────────────────────────
CREATE OR REPLACE VIEW workspace_credit_balances AS
SELECT
  workspace_id,
  credit_type,
  GREATEST(0, SUM(delta)) AS balance,
  COUNT(*) FILTER (WHERE event_type = 'usage')  AS total_usage_events,
  SUM(delta) FILTER (WHERE delta > 0)           AS total_credited,
  ABS(SUM(delta) FILTER (WHERE delta < 0))      AS total_debited,
  MAX(created_at)                               AS last_event_at
FROM credit_ledger
GROUP BY workspace_id, credit_type;
-- ── 3. Balance constraint enforcement via trigger ─────────────
-- Prevents negative balance at insert time
CREATE OR REPLACE FUNCTION enforce_credit_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  current_balance integer;
BEGIN
  -- Only enforce on debit events
  IF NEW.delta >= 0 THEN
    RETURN NEW;
  END IF;

  SELECT GREATEST(0, COALESCE(SUM(delta), 0))
  INTO current_balance
  FROM credit_ledger
  WHERE workspace_id = NEW.workspace_id
    AND credit_type  = NEW.credit_type;

  IF (current_balance + NEW.delta) < 0 THEN
    RAISE EXCEPTION 'Insufficient credits: balance=%, attempted debit=%',
      current_balance, ABS(NEW.delta);
  END IF;

  -- Set balance_after snapshot
  NEW.balance_after := current_balance + NEW.delta;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_credit_balance ON credit_ledger;
CREATE TRIGGER trg_enforce_credit_balance
  BEFORE INSERT ON credit_ledger
  FOR EACH ROW EXECUTE FUNCTION enforce_credit_balance();
-- ── 4. Helper function: debit credits (called from edge functions) ─
CREATE OR REPLACE FUNCTION debit_credits(
  p_workspace_id  uuid,
  p_credit_type   text,
  p_amount        integer,
  p_actor_id      uuid DEFAULT NULL,
  p_note          text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance integer;
  v_row     credit_ledger;
BEGIN
  -- Lock the workspace row to prevent concurrent overdraft
  PERFORM pg_advisory_xact_lock(hashtext(p_workspace_id::text || p_credit_type));

  SELECT GREATEST(0, COALESCE(SUM(delta), 0))
  INTO v_balance
  FROM credit_ledger
  WHERE workspace_id = p_workspace_id AND credit_type = p_credit_type;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', v_balance);
  END IF;

  INSERT INTO credit_ledger
    (workspace_id, credit_type, event_type, delta, balance_after, actor_user_id, note)
  VALUES
    (p_workspace_id, p_credit_type, 'usage', -p_amount, v_balance - p_amount, p_actor_id, p_note)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('success', true, 'balance', v_balance - p_amount, 'ledger_id', v_row.id);
END;
$$;
-- ── 5. Helper function: allocate credits (subscriptions/admin) ─
CREATE OR REPLACE FUNCTION allocate_credits(
  p_workspace_id  uuid,
  p_credit_type   text,
  p_amount        integer,
  p_event_type    text DEFAULT 'purchase',
  p_actor_id      uuid DEFAULT NULL,
  p_note          text DEFAULT NULL,
  p_metadata      jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance integer;
  v_row     credit_ledger;
BEGIN
  SELECT GREATEST(0, COALESCE(SUM(delta), 0))
  INTO v_balance
  FROM credit_ledger
  WHERE workspace_id = p_workspace_id AND credit_type = p_credit_type;

  INSERT INTO credit_ledger
    (workspace_id, credit_type, event_type, delta, balance_after, actor_user_id, note, metadata)
  VALUES
    (p_workspace_id, p_credit_type, p_event_type, p_amount, v_balance + p_amount, p_actor_id, p_note, p_metadata)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('success', true, 'balance', v_balance + p_amount, 'ledger_id', v_row.id);
END;
$$;
-- ── 6. Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_credit_ledger_workspace_type
  ON credit_ledger (workspace_id, credit_type);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at
  ON credit_ledger (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_actor
  ON credit_ledger (actor_user_id);
-- ── 7. Migrate existing balance data ─────────────────────────
-- Run this ONCE after applying the migration to seed the ledger
-- from the existing workspaces.search_credits_remaining etc.
-- Adjust column names to match your actual schema.

DO $$
DECLARE
  ws RECORD;
BEGIN
  FOR ws IN SELECT id, owner_id,
    COALESCE(search_credits_remaining, 0)      AS sc,
    COALESCE(ai_credits_remaining, 0)          AS ai,
    COALESCE(email_sends_remaining, 0)         AS em,
    COALESCE(enrichment_credits_remaining, 0)  AS en
  FROM workspaces
  LOOP
    IF ws.sc > 0 THEN
      INSERT INTO credit_ledger (workspace_id, credit_type, event_type, delta, balance_after, note)
      VALUES (ws.id, 'search', 'purchase', ws.sc, ws.sc, 'Migration: seeded from workspaces table');
    END IF;
    IF ws.ai > 0 THEN
      INSERT INTO credit_ledger (workspace_id, credit_type, event_type, delta, balance_after, note)
      VALUES (ws.id, 'ai', 'purchase', ws.ai, ws.ai, 'Migration: seeded from workspaces table');
    END IF;
    IF ws.em > 0 THEN
      INSERT INTO credit_ledger (workspace_id, credit_type, event_type, delta, balance_after, note)
      VALUES (ws.id, 'email', 'purchase', ws.em, ws.em, 'Migration: seeded from workspaces table');
    END IF;
    IF ws.en > 0 THEN
      INSERT INTO credit_ledger (workspace_id, credit_type, event_type, delta, balance_after, note)
      VALUES (ws.id, 'enrichment', 'purchase', ws.en, ws.en, 'Migration: seeded from workspaces table');
    END IF;
  END LOOP;
END;
$$;
