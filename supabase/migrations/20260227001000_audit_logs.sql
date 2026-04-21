-- ============================================================
-- MUSHIN — Immutable Audit Log Migration
-- Migration: 20260227001000_audit_logs.sql
-- Append-only. No UPDATE or DELETE via RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who
  actor_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email   text,
  actor_role    text,
  -- What
  action        text        NOT NULL,  -- e.g. 'user.suspend', 'credits.adjust', 'session.revoke'
  resource_type text        NOT NULL,  -- e.g. 'user', 'workspace', 'subscription'
  resource_id   text,                  -- UUID or identifier of affected resource
  -- Context
  ip_address    inet,
  user_agent    text,
  -- Data
  old_value     jsonb,                 -- state before (where applicable)
  new_value     jsonb,                 -- state after (where applicable)
  metadata      jsonb       DEFAULT '{}',
  -- When
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS: append-only
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can insert
CREATE POLICY "admin_insert_audit" ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'support')
    )
  );

-- Admins + support can read
CREATE POLICY "admin_read_audit" ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'support')
    )
  );

-- Prevent DELETE via trigger (defense in depth)
CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are immutable and cannot be deleted';
END;
$$;

CREATE TRIGGER trg_no_delete_audit_logs
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_delete();

CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are immutable and cannot be modified';
END;
$$;

CREATE TRIGGER trg_no_update_audit_logs
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();

-- ── Helper: write audit log entry ────────────────────────────
CREATE OR REPLACE FUNCTION write_audit_log(
  p_actor_id      uuid,
  p_actor_email   text,
  p_actor_role    text,
  p_action        text,
  p_resource_type text,
  p_resource_id   text  DEFAULT NULL,
  p_ip_address    inet  DEFAULT NULL,
  p_user_agent    text  DEFAULT NULL,
  p_old_value     jsonb DEFAULT NULL,
  p_new_value     jsonb DEFAULT NULL,
  p_metadata      jsonb DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO audit_logs
    (actor_id, actor_email, actor_role, action, resource_type, resource_id,
     ip_address, user_agent, old_value, new_value, metadata)
  VALUES
    (p_actor_id, p_actor_email, p_actor_role, p_action, p_resource_type, p_resource_id,
     p_ip_address, p_user_agent, p_old_value, p_new_value, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor       ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource    ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs (created_at DESC);

-- ── Auto-log: credit ledger mutations ─────────────────────────
CREATE OR REPLACE FUNCTION audit_credit_ledger_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM write_audit_log(
    p_actor_id      := NEW.actor_user_id,
    p_actor_email   := (SELECT email FROM auth.users WHERE id = NEW.actor_user_id),
    p_actor_role    := 'system',
    p_action        := 'credits.' || NEW.event_type,
    p_resource_type := 'workspace',
    p_resource_id   := NEW.workspace_id::text,
    p_new_value     := jsonb_build_object(
                         'credit_type',   NEW.credit_type,
                         'delta',         NEW.delta,
                         'balance_after', NEW.balance_after,
                         'note',          NEW.note
                       ),
    p_metadata      := NEW.metadata
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_credit_ledger
  AFTER INSERT ON credit_ledger
  FOR EACH ROW EXECUTE FUNCTION audit_credit_ledger_insert();

