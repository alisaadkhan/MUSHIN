-- =============================================================================
-- Phase 3 Features Migration
-- Support tickets, notifications, missing RPCs, integrity fixes
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SUPPORT TICKETS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  subject      TEXT NOT NULL,
  description  TEXT NOT NULL,
  priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category     TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'billing', 'technical', 'feature_request', 'bug')),
  admin_notes  TEXT,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_ticket_replies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin   BOOLEAN NOT NULL DEFAULT FALSE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_replies_ticket_id ON support_ticket_replies(ticket_id);

-- RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_replies ENABLE ROW LEVEL SECURITY;

-- Users can see and manage their own tickets
CREATE POLICY "Users manage own tickets"
  ON support_tickets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can see and update all tickets
CREATE POLICY "Admins manage all tickets"
  ON support_tickets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  );

-- Users can see replies on their tickets
CREATE POLICY "Users see replies on own tickets"
  ON support_ticket_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_id AND st.user_id = auth.uid()
    )
  );

-- Users can add replies to own tickets
CREATE POLICY "Users reply to own tickets"
  ON support_ticket_replies FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_id AND st.user_id = auth.uid()
    )
  );

-- Admins can see and add replies for all tickets
CREATE POLICY "Admins manage all replies"
  ON support_ticket_replies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_support_ticket_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  type        TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role inserts notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE); -- Service role inserts, no user restriction

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ANNOUNCEMENTS TABLE (persist AdminAnnouncements to DB)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success')),
  target_type     TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'role', 'plan', 'user')),
  target_value    TEXT,  -- role name, plan name, or user_id
  admin_user_id   UUID NOT NULL REFERENCES auth.users(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active announcements
CREATE POLICY "Users read active announcements"
  ON announcements FOR SELECT
  USING (is_active = TRUE);

-- Only admins can manage announcements
CREATE POLICY "Admins manage announcements"
  ON announcements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4a. CAMPAIGN METRICS TABLE (idempotent — table may already exist on remote)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_link_id  UUID NOT NULL REFERENCES tracking_links(id) ON DELETE CASCADE,
  influencer_id     UUID REFERENCES influencer_profiles(id) ON DELETE SET NULL,
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  clicks            INTEGER NOT NULL DEFAULT 0,
  conversions       INTEGER NOT NULL DEFAULT 0,
  revenue_generated NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_tracking_link_id
  ON campaign_metrics(tracking_link_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date
  ON campaign_metrics(date DESC);

ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_metrics_tracking_link_id_date_key'
  ) THEN
    ALTER TABLE campaign_metrics
      ADD CONSTRAINT campaign_metrics_tracking_link_id_date_key
        UNIQUE (tracking_link_id, date);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MISSING RPC: increment_click_metric
-- ─────────────────────────────────────────────────────────────────────────────
-- Accepts named params matching track-click edge function: link_id, metric_date, influencer_uuid
CREATE OR REPLACE FUNCTION increment_click_metric(
  link_id         UUID,
  metric_date     DATE    DEFAULT CURRENT_DATE,
  influencer_uuid UUID    DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO campaign_metrics (tracking_link_id, influencer_id, date, clicks, created_at, updated_at)
  VALUES (link_id, influencer_uuid, metric_date, 1, NOW(), NOW())
  ON CONFLICT (tracking_link_id, date) DO UPDATE
    SET clicks     = campaign_metrics.clicks + 1,
        updated_at = NOW();
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ADMIN SEND NOTIFICATION to target audience RPC
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
    SELECT ARRAY_AGG(id) INTO v_user_ids FROM auth.users;
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

  IF v_user_ids IS NULL OR ARRAY_LENGTH(v_user_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO notifications (user_id, title, body, type, link)
  SELECT uid, p_title, p_body, p_type, p_link
  FROM UNNEST(v_user_ids) AS uid;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. MARK NOTIFICATIONS READ/ARCHIVED RPCs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE notifications SET is_read = TRUE
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE notifications SET is_read = TRUE
  WHERE user_id = auth.uid() AND is_read = FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION archive_notification(p_notification_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE notifications SET is_archived = TRUE
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. NOTIFICATION LOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  title         TEXT NOT NULL,
  body          TEXT,
  target_type   TEXT NOT NULL,
  target_value  TEXT,
  recipient_count INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins see notification log"
  ON notification_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Service insert notification log"
  ON notification_log FOR INSERT
  WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. WORKSPACE MEMBER INVITE RPC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION invite_workspace_member(
  p_workspace_id UUID,
  p_email        TEXT,
  p_role         TEXT DEFAULT 'member'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner_id UUID;
  v_target_user_id UUID;
BEGIN
  -- Only workspace owners/admins can invite
  SELECT owner_id INTO v_owner_id FROM workspaces WHERE id = p_workspace_id;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Workspace not found');
  END IF;

  IF v_owner_id != auth.uid() THEN
    -- Check if caller is workspace admin
    IF NOT EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'admin'
    ) THEN
      RETURN jsonb_build_object('error', 'Unauthorized');
    END IF;
  END IF;

  -- Check if user exists by email
  SELECT id INTO v_target_user_id FROM auth.users WHERE email = p_email;
  IF v_target_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found. They must sign up first.');
  END IF;

  -- Check already a member
  IF EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = v_target_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'User is already a member');
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (p_workspace_id, v_target_user_id, p_role);

  RETURN jsonb_build_object('success', true, 'user_id', v_target_user_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. REMOVE WORKSPACE MEMBER RPC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION remove_workspace_member(
  p_workspace_id UUID,
  p_user_id      UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner_id UUID;
  v_target_role TEXT;
BEGIN
  SELECT owner_id INTO v_owner_id FROM workspaces WHERE id = p_workspace_id;

  -- Cannot remove the owner
  SELECT role INTO v_target_role FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;

  IF v_target_role = 'owner' THEN
    RETURN jsonb_build_object('error', 'Cannot remove the workspace owner');
  END IF;

  -- Only owner or admin can remove
  IF v_owner_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'admin'
    ) THEN
      RETURN jsonb_build_object('error', 'Unauthorized');
    END IF;
  END IF;

  DELETE FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RESTORE AI CREDIT (for rollback on failed AI call)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION restore_ai_credit(ws_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE workspaces
  SET ai_credits_remaining = ai_credits_remaining + 1
  WHERE id = ws_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: campaign_metrics UNIQUE constraint (tracking_link_id, date) is now
--       added in section 4a above. The old single-column constraint is omitted.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. ANOMALY LOGS (ensure table exists for delete-account cleanup)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type   TEXT NOT NULL,
  details      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE anomaly_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins see anomaly logs"
  ON anomaly_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
    )
  );
