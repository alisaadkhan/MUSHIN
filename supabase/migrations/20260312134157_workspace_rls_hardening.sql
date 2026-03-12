-- RLS Hardening for Workspaces
-- Created to fix data exposure and tracking event spam

-- 1. Hardening follower_history
ALTER TABLE follower_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace restricted access for follower_history" ON follower_history;
CREATE POLICY "Workspace restricted access for follower_history" ON follower_history
FOR ALL
USING (
  profile_id IN (
    SELECT id FROM influencer_profiles
    WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

-- 2. Hardening audience_analysis
ALTER TABLE audience_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace restricted access for audience_analysis" ON audience_analysis;
CREATE POLICY "Workspace restricted access for audience_analysis" ON audience_analysis
FOR ALL
USING (
  profile_id IN (
    SELECT id FROM influencer_profiles
    WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

-- 3. Hardening linked_accounts
ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace restricted access for linked_accounts" ON linked_accounts;
CREATE POLICY "Workspace restricted access for linked_accounts" ON linked_accounts
FOR ALL
USING (
  profile_id_a IN (
    SELECT id FROM influencer_profiles
    WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

-- 4. Fix tracking_events spam
-- Remove anonymous insert permissions
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only insert for tracking_events" ON tracking_events;
CREATE POLICY "Service role only insert for tracking_events" ON tracking_events
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "Workspace view only for tracking_events" ON tracking_events;
CREATE POLICY "Workspace view only for tracking_events" ON tracking_events
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

-- 5. Enable pgcrypto for secret encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;
