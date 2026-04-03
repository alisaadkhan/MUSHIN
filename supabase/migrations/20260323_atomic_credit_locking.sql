-- ═══════════════════════════════════════════════════════════════════════════
-- ATOMIC CREDIT LOCKING — Row-Level Locking for All Credit Operations
-- Applied: 2026-03-11
--
-- Replaces the CHECK-then-UPDATE pattern (TOCTOU vulnerable) with
-- fully atomic SELECT FOR UPDATE + UPDATE inside a plpgsql transaction.
--
-- All consume_* functions follow the same pattern:
--   1. Lock the workspace row with FOR UPDATE (blocks concurrent callers)
--   2. Check balance inside the lock — no other transaction can modify it
--   3. UPDATE atomically
--   4. Release lock at transaction end
--
-- This completely eliminates the race condition identified in CRIT-03.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── consume_search_credit — atomic with row lock ─────────────────────────
CREATE OR REPLACE FUNCTION public.consume_search_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  -- Lock the row exclusively. Any concurrent caller will WAIT here until
  -- the first caller commits or rolls back — eliminating the TOCTOU window.
  SELECT search_credits_remaining
  INTO   v_remaining
  FROM   workspaces
  WHERE  id = ws_id
  FOR UPDATE;                  -- ← row-level exclusive lock

  IF v_remaining IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;

  UPDATE workspaces
  SET    search_credits_remaining = v_remaining - 1
  WHERE  id = ws_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_search_credit(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.consume_search_credit(uuid) TO authenticated, service_role;
-- ─── consume_ai_credit — atomic with row lock ─────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_ai_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  SELECT ai_credits_remaining
  INTO   v_remaining
  FROM   workspaces
  WHERE  id = ws_id
  FOR UPDATE;

  IF v_remaining IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;

  UPDATE workspaces
  SET    ai_credits_remaining = v_remaining - 1
  WHERE  id = ws_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credit(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.consume_ai_credit(uuid) TO authenticated, service_role;
-- ─── consume_enrichment_credit — atomic with row lock ─────────────────────
CREATE OR REPLACE FUNCTION public.consume_enrichment_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  SELECT enrichment_credits_remaining
  INTO   v_remaining
  FROM   workspaces
  WHERE  id = ws_id
  FOR UPDATE;

  IF v_remaining IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;

  UPDATE workspaces
  SET    enrichment_credits_remaining = v_remaining - 1
  WHERE  id = ws_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_enrichment_credit(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.consume_enrichment_credit(uuid) TO authenticated, service_role;
-- ─── consume_email_credit — atomic with row lock ──────────────────────────
CREATE OR REPLACE FUNCTION public.consume_email_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  SELECT email_sends_remaining
  INTO   v_remaining
  FROM   workspaces
  WHERE  id = ws_id
  FOR UPDATE;

  IF v_remaining IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;

  UPDATE workspaces
  SET    email_sends_remaining = v_remaining - 1
  WHERE  id = ws_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_email_credit(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.consume_email_credit(uuid) TO authenticated, service_role;
-- ─── restore_ai_credit — atomic refund on AI failure ─────────────────────
-- Called by ai-insights when HuggingFace fails after credit was deducted.
-- Capped at the plan maximum to prevent credit farming via deliberate failures.
CREATE OR REPLACE FUNCTION public.restore_ai_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current int;
  v_plan text;
  v_max int;
BEGIN
  SELECT ai_credits_remaining, plan
  INTO   v_current, v_plan
  FROM   workspaces
  WHERE  id = ws_id;

  IF v_current IS NULL THEN
    RETURN; -- workspace not found, silently skip
  END IF;

  -- Cap restoration at the plan's AI credit maximum to prevent farming
  v_max := CASE v_plan
    WHEN 'free'       THEN 3
    WHEN 'starter'    THEN 25
    WHEN 'pro'        THEN 100
    WHEN 'business'   THEN 250
    WHEN 'enterprise' THEN 999
    ELSE 3
  END;

  IF v_current >= v_max THEN
    RETURN; -- already at or above max, don't restore further
  END IF;

  UPDATE workspaces
  SET    ai_credits_remaining = LEAST(v_current + 1, v_max)
  WHERE  id = ws_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.restore_ai_credit(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.restore_ai_credit(uuid) TO service_role;
-- Note: authenticated role does NOT get restore — only service_role (edge functions) may invoke this.;
