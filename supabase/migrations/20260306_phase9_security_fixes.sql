-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 9 Security Fixes
-- Applied: 2026-03-06
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- H-1: Atomic credit adjustment RPC (eliminates TOCTOU race condition)
-- Replaces the read-modify-write pattern in admin-adjust-credits edge function.
-- GREATEST(..., 0) enforces the non-negative credit invariant in-database.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_adjust_credits(
  p_workspace_id         uuid,
  p_search_credits       integer DEFAULT 0,
  p_ai_credits           integer DEFAULT 0,
  p_email_sends          integer DEFAULT 0,
  p_enrichment_credits   integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin or super_admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  UPDATE workspaces
  SET
    search_credits_remaining     = GREATEST(search_credits_remaining     + p_search_credits,     0),
    ai_credits_remaining         = GREATEST(ai_credits_remaining         + p_ai_credits,         0),
    email_sends_remaining        = GREATEST(email_sends_remaining        + p_email_sends,        0),
    enrichment_credits_remaining = GREATEST(enrichment_credits_remaining + p_enrichment_credits, 0)
  WHERE id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
  END IF;
END;
$$;

-- Index to speed up workspace lookups by owner (used in credit adjustments)
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- H-2: Lock down restore_email_credit and restore_ai_credit
-- These functions should only be callable by edge functions running with
-- service_role, never by authenticated browser clients.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION restore_email_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION restore_email_credit(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION restore_email_credit(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION restore_ai_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION restore_ai_credit(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION restore_ai_credit(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- M-6: Fix admin_send_notification to exclude unverified and banned users
-- Previously SELECT ARRAY_AGG(id) FROM auth.users returned ALL rows including
-- accounts that have never verified their email or are currently banned.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_send_notification(
  p_title       TEXT,
  p_body        TEXT,
  p_type        TEXT DEFAULT 'info',
  p_link        TEXT DEFAULT NULL,
  p_target_type TEXT DEFAULT 'all',  -- 'all', 'role', 'plan', 'user'
  p_target_value TEXT DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_ids UUID[];
  v_count    INTEGER;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  IF p_target_type = 'all' THEN
    -- M-6 fix: exclude unverified accounts and currently-banned users
    SELECT ARRAY_AGG(id) INTO v_user_ids
    FROM auth.users
    WHERE email_confirmed_at IS NOT NULL
      AND (banned_until IS NULL OR banned_until < NOW());
  ELSIF p_target_type = 'role' THEN
    SELECT ARRAY_AGG(user_id) INTO v_user_ids
    FROM user_roles WHERE role = p_target_value;
  ELSIF p_target_type = 'plan' THEN
    SELECT ARRAY_AGG(wm.user_id) INTO v_user_ids
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE w.plan = p_target_value;
  ELSIF p_target_type = 'user' THEN
    v_user_ids := ARRAY[p_target_value::UUID];
  END IF;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO notifications (user_id, title, body, type, link)
  SELECT UNNEST(v_user_ids), p_title, p_body, p_type, p_link;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
