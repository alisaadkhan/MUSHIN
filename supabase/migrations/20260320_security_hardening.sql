-- ═══════════════════════════════════════════════════════════════════════════════
-- SECURITY HARDENING MIGRATION
-- Applied: 2026-03-20
-- Addresses: CRITICAL billing field mutation, user_roles write access,
--            subscriptions write access, schema exposure, missing DML policies,
--            security event logging, and function execute grants.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: workspaces — split broad ALL policy into granular per-operation
--            policies and add billing-field immutability trigger.
-- CRITICAL: old policy "Workspace owner access" used bare USING clause with no
-- WITH CHECK, meaning the Supabase REST API allowed owners to UPDATE plan,
-- credits_remaining, stripe_customer_id, etc. directly.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Drop the dangerously broad original policy
DROP POLICY IF EXISTS "Workspace owner access" ON public.workspaces;

-- 1b. SELECT: owner and all workspace members can read the workspace row
DROP POLICY IF EXISTS "ws_select" ON public.workspaces;
CREATE POLICY "ws_select" ON public.workspaces
  FOR SELECT
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = public.workspaces.id AND user_id = auth.uid()
    )
  );

-- 1c. INSERT: a user may only create a workspace where they are the owner
DROP POLICY IF EXISTS "ws_insert" ON public.workspaces;
CREATE POLICY "ws_insert" ON public.workspaces
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- 1d. UPDATE: owner may update benign metadata fields only (name, settings).
--     Billing fields are additionally protected by the trigger below.
DROP POLICY IF EXISTS "ws_update" ON public.workspaces;
CREATE POLICY "ws_update" ON public.workspaces
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- 1e. DELETE: explicitly blocked for authenticated users. Service role only.
DROP POLICY IF EXISTS "ws_delete" ON public.workspaces;
CREATE POLICY "ws_delete" ON public.workspaces
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Billing field immutability trigger on workspaces
-- Authenticated users may NEVER directly change billing/credit/plan fields.
-- Only service_role (edge functions using the service key) can modify these.
-- This acts as a second layer of defence even if RLS policies are misconfigured.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_billing_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role bypass — edge functions run with service key and must update billing
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block direct mutation of billing / credit / plan fields by authenticated users
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Direct modification of workspace.plan is forbidden';
  END IF;
  IF NEW.search_credits_remaining IS DISTINCT FROM OLD.search_credits_remaining THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Direct modification of search_credits_remaining is forbidden';
  END IF;
  IF NEW.ai_credits_remaining IS DISTINCT FROM OLD.ai_credits_remaining THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Direct modification of ai_credits_remaining is forbidden';
  END IF;
  IF NEW.email_sends_remaining IS DISTINCT FROM OLD.email_sends_remaining THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Direct modification of email_sends_remaining is forbidden';
  END IF;
  IF NEW.enrichment_credits_remaining IS DISTINCT FROM OLD.enrichment_credits_remaining THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Direct modification of enrichment_credits_remaining is forbidden';
  END IF;
  IF NEW.credits_reset_at IS DISTINCT FROM OLD.credits_reset_at THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Direct modification of credits_reset_at is forbidden';
  END IF;
  IF NEW.monthly_api_budget_usd IS DISTINCT FROM OLD.monthly_api_budget_usd THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Direct modification of monthly_api_budget_usd is forbidden';
  END IF;
  IF NEW.current_month_spend_usd IS DISTINCT FROM OLD.current_month_spend_usd THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Direct modification of current_month_spend_usd is forbidden';
  END IF;
  IF NEW.enrichment_locked IS DISTINCT FROM OLD.enrichment_locked THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: Direct modification of enrichment_locked is forbidden';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_immutability ON public.workspaces;
CREATE TRIGGER trg_billing_immutability
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_billing_immutability();

-- Log all SECURITY_VIOLATION trigger exceptions to security_events (defined in Section 9)
-- The trigger raises an exception, so the transaction rolls back — no additional log needed here.

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: user_roles — explicit write lockdown
-- The SELECT policy already restricts reads to own row.
-- Adding an explicit service_role-only write policy.
-- Without it, INSERT/UPDATE/DELETE are denied by default but the intent is implicit.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ur_service_write" ON public.user_roles;
CREATE POLICY "ur_service_write" ON public.user_roles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Revoke direct execute on has_role from public (query by SECURITY DEFINER only)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: subscriptions — explicit write lockdown
-- Only service_role can INSERT/UPDATE/DELETE subscription rows.
-- Authenticated users may only SELECT their own workspace subscription.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "sub_service_write" ON public.subscriptions;
CREATE POLICY "sub_service_write" ON public.subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: credits_usage — service_role writes, workspace-member reads
-- Authenticated clients must NEVER directly inject credit usage records.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "cu_service_write" ON public.credits_usage;
CREATE POLICY "cu_service_write" ON public.credits_usage
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: search_history — add INSERT policy for workspace members
-- Workspace members may INSERT history records only for their own workspace.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "sh_member_insert" ON public.search_history;
CREATE POLICY "sh_member_insert" ON public.search_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = search_history.workspace_id AND user_id = auth.uid()
    )
  );

-- Service role can manage all search_history (for background jobs)
DROP POLICY IF EXISTS "sh_service_write" ON public.search_history;
CREATE POLICY "sh_service_write" ON public.search_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: outreach_log — add workspace-member INSERT + UPDATE policies
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ol_member_insert" ON public.outreach_log;
CREATE POLICY "ol_member_insert" ON public.outreach_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = outreach_log.campaign_id AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ol_member_update" ON public.outreach_log;
CREATE POLICY "ol_member_update" ON public.outreach_log
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = outreach_log.campaign_id AND wm.user_id = auth.uid()
    )
  );

-- Service role for webhook-driven status updates
DROP POLICY IF EXISTS "ol_service_write" ON public.outreach_log;
CREATE POLICY "ol_service_write" ON public.outreach_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8: campaign_activity — add workspace-member INSERT policy
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ca_member_insert" ON public.campaign_activity;
CREATE POLICY "ca_member_insert" ON public.campaign_activity
  FOR INSERT
  WITH CHECK (
    auth.uid() = campaign_activity.user_id
    AND EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_activity.campaign_id AND wm.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 9: notifications table — create with RLS if not already present
-- admin_send_notification inserts into this table via service_role.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'info',   -- 'info', 'warning', 'success', 'error'
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure columns exist in case the table was created previously without them
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
DROP POLICY IF EXISTS "notif_own_select" ON public.notifications;
CREATE POLICY "notif_own_select" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
DROP POLICY IF EXISTS "notif_own_update" ON public.notifications;
CREATE POLICY "notif_own_update" ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only service_role can create notifications
DROP POLICY IF EXISTS "notif_service_write" ON public.notifications;
CREATE POLICY "notif_service_write" ON public.notifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 10: tracking_events — enable RLS (public write for click tracking
--             is intentional, but reads are restricted to workspace owners)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;

-- Public/anon can INSERT (click tracking from redirected links)
DROP POLICY IF EXISTS "te_public_insert" ON public.tracking_events;
CREATE POLICY "te_public_insert" ON public.tracking_events
  FOR INSERT
  WITH CHECK (true);

-- Only workspace owners can SELECT their own tracking events
DROP POLICY IF EXISTS "te_owner_select" ON public.tracking_events;
CREATE POLICY "te_owner_select" ON public.tracking_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tracking_links tl
      JOIN public.workspace_members wm ON wm.workspace_id = tl.workspace_id
      WHERE tl.id = tracking_events.link_id AND wm.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 11: influencers_cache — enable RLS (currently has no RLS)
-- Readable by any authenticated user (shared public profile cache).
-- Writable only by service_role (enrichment pipeline).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.influencers_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ic_auth_select" ON public.influencers_cache;
CREATE POLICY "ic_auth_select" ON public.influencers_cache
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "ic_service_write" ON public.influencers_cache;
CREATE POLICY "ic_service_write" ON public.influencers_cache
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 12: security_events table — structured log for security anomalies
-- Written only by SECURITY DEFINER functions and service_role edge functions.
-- Admins and super_admins can read. Authenticated users can never write.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'billing_violation', 'role_escalation', 'unauthorized_access', 'rate_limit_breach', 'suspicious_pattern'
  severity text NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ip_address text,
  endpoint text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_ts
  ON public.security_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user
  ON public.security_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Admins can read security events
DROP POLICY IF EXISTS "se_admin_select" ON public.security_events;
CREATE POLICY "se_admin_select" ON public.security_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Only service_role can write security events (no authenticated insert allowed)
DROP POLICY IF EXISTS "se_service_write" ON public.security_events;
CREATE POLICY "se_service_write" ON public.security_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Convenience function for edge functions to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_severity text DEFAULT 'medium',
  p_user_id uuid DEFAULT NULL,
  p_workspace_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_endpoint text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_events(event_type, severity, user_id, workspace_id, ip_address, endpoint, payload)
  VALUES (p_event_type, p_severity, p_user_id, p_workspace_id, p_ip_address, p_endpoint, p_payload);
EXCEPTION WHEN OTHERS THEN
  -- Never let logging failure break the caller
  NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_security_event(text, text, uuid, uuid, text, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.log_security_event(text, text, uuid, uuid, text, text, jsonb) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 13: Lock down SECURITY DEFINER functions from unauthenticated callers
-- Prevent anon from calling credit consumption, billing, or audit functions.
-- ─────────────────────────────────────────────────────────────────────────────

-- consume_search_credit: only service_role (called by search-influencers fn)
REVOKE EXECUTE ON FUNCTION public.consume_search_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_search_credit(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_search_credit(uuid) TO service_role;

-- admin_adjust_credits: only service_role
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, integer, integer, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, integer, integer, integer) TO service_role;

-- admin_send_notification: only service_role
REVOKE EXECUTE ON FUNCTION public.admin_send_notification(text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_send_notification(text, text, text, text, text, text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_send_notification(text, text, text, text, text, text) TO service_role;

-- check_workspace_budget: only service_role
REVOKE EXECUTE ON FUNCTION public.check_workspace_budget(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_workspace_budget(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.check_workspace_budget(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 14: Schema introspection — restrict anon from enumerating tables
-- Supabase exposes information_schema to all roles by default.
-- Revoking SELECT on sensitive catalog views blocks schema crawling.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE SELECT ON information_schema.tables    FROM anon;
REVOKE SELECT ON information_schema.columns   FROM anon;
REVOKE SELECT ON information_schema.routines  FROM anon;
REVOKE SELECT ON information_schema.triggers  FROM anon;
REVOKE SELECT ON information_schema.views     FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 15: enrichment_jobs — split broad ALL policy into member SELECT + service write
-- The old "Workspace owners can manage jobs" allowed any owner to INSERT,
-- UPDATE, or DELETE enrichment jobs, which could be used to queue arbitrary work.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Workspace owners can manage jobs" ON public.enrichment_jobs;

DROP POLICY IF EXISTS "ej_member_select" ON public.enrichment_jobs;
CREATE POLICY "ej_member_select" ON public.enrichment_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = enrichment_jobs.workspace_id AND user_id = auth.uid()
    )
  );

-- Only service_role (enrichment pipeline) can INSERT/UPDATE/DELETE jobs
DROP POLICY IF EXISTS "ej_service_write" ON public.enrichment_jobs;
CREATE POLICY "ej_service_write" ON public.enrichment_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 16: workspace_members — tighten policies
-- Members should only see their own row, not enumerate all members.
-- Owners should be able to see all members of their workspace.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can view own membership" ON public.workspace_members;

-- Members see their own row; owners see all their workspace members
DROP POLICY IF EXISTS "wm_select" ON public.workspace_members;
CREATE POLICY "wm_select" ON public.workspace_members
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE id = workspace_members.workspace_id AND owner_id = auth.uid()
    )
  );

-- Only service_role can INSERT/UPDATE/DELETE workspace members (via edge functions)
DROP POLICY IF EXISTS "wm_service_write" ON public.workspace_members;
CREATE POLICY "wm_service_write" ON public.workspace_members
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 17: invoices — add service_role write policy
-- Currently only SELECT is allowed. Service_role must INSERT invoice records.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "inv_service_write" ON public.invoices;
CREATE POLICY "inv_service_write" ON public.invoices
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 18: Prevent anon role from calling any of our RPC helper functions
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.get_user_workspace()       FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_id()    FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.system_integrity_audit()   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.system_integrity_audit()   FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.system_integrity_audit()   TO service_role;
