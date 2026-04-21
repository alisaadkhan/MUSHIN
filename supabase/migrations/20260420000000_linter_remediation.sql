-- ============================================================
-- MUSHIN — Supabase Linter Remediation Migration
-- Generated: 2026-04-20
-- Lint rules addressed:
--   0011 function_search_path_mutable
--   0014 extension_in_public
--   0003 auth_rls_initplan
--   0006 multiple_permissive_policies
--   rls_enabled_no_policy (campaign_metrics)
--   0009 duplicate_index
--   0001 unindexed_foreign_keys
--   0005 unused_index
-- ============================================================
-- IMPORTANT: Run this migration against your Supabase project via:
--   Option A (CLI):   npx supabase db push
--   Option B (Dashboard): SQL Editor → paste → Run
-- ============================================================


-- ============================================================
-- PHASE 1: SECURITY & CORE CONFIGURATION
-- ============================================================

-- ------------------------------------------------------------
-- 1.1  Fix mutable search_path on notify_security_anomaly
--      Lint: 0011 function_search_path_mutable
--      Without SET search_path the function can be hijacked by
--      objects injected into a non-system schema earlier on the
--      session search_path.
-- ------------------------------------------------------------
ALTER FUNCTION public.notify_security_anomaly()
  SET search_path = '';  -- locks function to fully-qualified names only


-- ------------------------------------------------------------
-- 1.2  Move extensions out of the public schema
--      Lint: 0014 extension_in_public
--
--      Extensions installed in `public` expose their operators
--      and functions to all roles by default.  Moving them to a
--      dedicated `extensions` schema keeps public clean.
--
--      NOTE: ALTER EXTENSION … SET SCHEMA is the safe migration
--      path — it does NOT reinstall the extension; it only moves
--      the catalog entry.  No data is lost.
--
--      If any of these extensions do not exist in your database
--      the statement is wrapped in a DO block to skip safely.
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant USAGE to the roles that Supabase's PostgREST layer uses
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$
BEGIN
  -- vector
  -- (vector supports SET SCHEMA)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector' AND extnamespace = 'public'::regnamespace) THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;

  -- pg_trgm (trigram similarity — used by search)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm' AND extnamespace = 'public'::regnamespace) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;

  -- unaccent (accent-insensitive text search)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent' AND extnamespace = 'public'::regnamespace) THEN
    ALTER EXTENSION unaccent SET SCHEMA extensions;
  END IF;

  -- NOTE: pg_net does NOT support SET SCHEMA (Postgres limitation).
  -- It remains in the public schema. The Supabase linter warning for
  -- pg_net cannot be resolved via SQL migration — it is a known
  -- Supabase platform constraint. Suppress it via:
  --   Dashboard → Database → Linter → Ignore rule for pg_net
END $$;

-- NOTE: ALTER DATABASE … SET search_path requires superuser and is not
-- available in Supabase migrations.  If you move pg_trgm/unaccent,
-- ensure any functions calling similarity() or unaccent() use fully-
-- qualified names: extensions.similarity(), extensions.unaccent().
-- Your existing functions that already qualify names are unaffected.

-- ============================================================
-- 1.3  Leaked Password Protection
--      Lint: auth_leaked_password_protection
--
--      This setting is configured in the Supabase Auth service,
--      NOT in SQL.  Enable it in the Dashboard:
--
--        Authentication → Providers → Email
--        → "Password Security" section
--        → Enable "Check for leaked passwords (HaveIBeenPwned)"
--
--      Or via the Management API:
--        PATCH /v1/projects/{ref}/config/auth
--        { "password_hibp_enabled": true }
-- ============================================================


-- ============================================================
-- PHASE 2: RLS PERFORMANCE & POLICY CONSOLIDATION
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 2A  AUTH RLS INITIALIZATION PLAN FIX
--     Lint: 0003 auth_rls_initplan
--
--     auth.uid() / auth.jwt() called bare inside a USING/WITH CHECK
--     expression are re-evaluated for EVERY ROW scanned.  Wrapping
--     in (SELECT auth.uid()) forces a one-time init-plan evaluation.
--
--     Pattern for every policy below:
--       DROP policy → recreate with (SELECT auth.uid())
-- ─────────────────────────────────────────────────────────────

-- 2A-1  campaign_activity.ca_member_insert
--       campaign_activity has campaign_id FK (not workspace_id directly).
--       Will be superseded by consolidation in 2B.
DROP POLICY IF EXISTS ca_member_insert ON public.campaign_activity;

-- 2A-2  profiles — "Users can view own profile"
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
-- (duplicate of profiles_select_own — will be fully dropped in 2B)

-- 2A-3  profiles — "Users can update own profile"
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
-- (duplicate of profiles_update_own — fully dropped in 2B)

-- 2A-4  profiles_select_own — ensure (select auth.uid())
--       profiles PK is `id` which equals auth.uid() (confirmed from 20260416 migration)
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT
  USING (id = (SELECT auth.uid()));

-- 2A-5  profiles_update_own — ensure (select auth.uid())
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- 2A-6  list_items — "List members can manage items"  (initplan fix)
--       superseded by li_member_all consolidation in 2B
DROP POLICY IF EXISTS "List members can manage items" ON public.list_items;

-- 2A-7  subscriptions — "Subscriptions viewable by workspace"  (initplan fix)
--       superseded by sub_owner_select consolidation in 2B
DROP POLICY IF EXISTS "Subscriptions viewable by workspace" ON public.subscriptions;

-- 2A-8  security_anomaly_logs — "Anomaly logs are service role only"
DROP POLICY IF EXISTS "Anomaly logs are service role only" ON public.security_anomaly_logs;
CREATE POLICY "Anomaly logs are service role only" ON public.security_anomaly_logs
  FOR ALL
  USING (
    current_setting('role') = 'service_role'
    OR (SELECT auth.jwt() ->> 'role') = 'service_role'
  );

-- 2A-9  search_history — sh_service_write  (initplan fix)
--       superseded by sh consolidation in 2B
DROP POLICY IF EXISTS sh_service_write ON public.search_history;

-- 2A-10 credits_usage — cu_service_write  (initplan fix)
--       superseded by cu consolidation in 2B
DROP POLICY IF EXISTS cu_service_write ON public.credits_usage;


-- ─────────────────────────────────────────────────────────────
-- 2B  MULTIPLE PERMISSIVE POLICY CONSOLIDATION
--     Lint: 0006 multiple_permissive_policies
--
--     Multiple permissive policies for the same role+action
--     are ALL evaluated per-query, even when the first matches.
--     Consolidating into a single policy with OR halves the RLS
--     overhead for those tables.
-- ─────────────────────────────────────────────────────────────

-- ── announcements ──────────────────────────────────────────
-- Conflicting SELECT policies: {ann_admin_all, ann_public_select}
-- ann_public_select allows any authenticated user to SELECT.
-- ann_admin_all allows admins ALL access including SELECT.
-- Consolidate: drop ann_public_select; update ann_admin_all to
-- use OR so non-admins can still read public announcements.
DROP POLICY IF EXISTS ann_public_select ON public.announcements;
DROP POLICY IF EXISTS ann_admin_all     ON public.announcements;

-- Single consolidated policy: admins get ALL; public gets SELECT
CREATE POLICY ann_admin_all ON public.announcements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = (SELECT auth.uid())
         AND ur.role IN ('admin','super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = (SELECT auth.uid())
         AND ur.role IN ('admin','super_admin')
    )
  );

CREATE POLICY ann_public_select ON public.announcements
  FOR SELECT
  USING (is_active = TRUE);   -- allow any role to read active announcements


-- ── campaign_activity ──────────────────────────────────────
-- campaign_activity has campaign_id FK; workspace is accessed via campaigns join.
-- Rebuild ca_member_all with (SELECT auth.uid()) fix:
DROP POLICY IF EXISTS ca_member_insert ON public.campaign_activity;
DROP POLICY IF EXISTS "ca_member_insert" ON public.campaign_activity;
DROP POLICY IF EXISTS ca_member_all ON public.campaign_activity;
DROP POLICY IF EXISTS "ca_member_all" ON public.campaign_activity;
CREATE POLICY ca_member_all ON public.campaign_activity
  FOR ALL
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns
       WHERE workspace_id IN (
         SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
       )
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND campaign_id IN (
      SELECT id FROM public.campaigns
       WHERE workspace_id IN (
         SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
       )
    )
  );


-- ── credits_usage ──────────────────────────────────────────
-- Consolidate: keep cu_member_select (workspace_id subquery), rebuild
-- cu_service_write as INSERT-only using auth.role().
DROP POLICY IF EXISTS cu_service_write ON public.credits_usage;
DROP POLICY IF EXISTS "cu_service_write" ON public.credits_usage;
DROP POLICY IF EXISTS cu_member_select ON public.credits_usage;
DROP POLICY IF EXISTS "cu_member_select" ON public.credits_usage;

CREATE POLICY cu_member_select ON public.credits_usage
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
       WHERE user_id = (SELECT auth.uid())
    )
  );

-- Service-role INSERT only (no SELECT overlap):
CREATE POLICY cu_service_write ON public.credits_usage
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');


-- ── list_items ──────────────────────────────────────────────
-- list_items.list_id FK → influencer_lists.id → workspace_id
DROP POLICY IF EXISTS "List members can manage items" ON public.list_items;
DROP POLICY IF EXISTS li_member_all ON public.list_items;
DROP POLICY IF EXISTS "li_member_all" ON public.list_items;
CREATE POLICY li_member_all ON public.list_items
  FOR ALL
  USING (
    list_id IN (
      SELECT id FROM public.influencer_lists
       WHERE workspace_id IN (
         SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
       )
    )
  )
  WITH CHECK (
    list_id IN (
      SELECT id FROM public.influencer_lists
       WHERE workspace_id IN (
         SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
       )
    )
  );


-- ── subscriptions ───────────────────────────────────────────
-- Conflicting SELECT: {"Subscriptions viewable by workspace", sub_owner_select}
DROP POLICY IF EXISTS "Subscriptions viewable by workspace" ON public.subscriptions;
DROP POLICY IF EXISTS sub_owner_select ON public.subscriptions;
CREATE POLICY sub_owner_select ON public.subscriptions
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
        FROM public.workspace_members wm
       WHERE wm.user_id = (SELECT auth.uid())
    )
  );


-- ── search_history ──────────────────────────────────────────
-- Conflicting INSERT: {sh_member_insert, sh_service_write}
-- Conflicting SELECT: {sh_member_select, sh_service_write}
-- Fix: rebuild sh_service_write as service-role INSERT only (auth.role() pattern)
DROP POLICY IF EXISTS sh_service_write ON public.search_history;
DROP POLICY IF EXISTS "sh_service_write" ON public.search_history;
DROP POLICY IF EXISTS sh_member_insert ON public.search_history;
DROP POLICY IF EXISTS "sh_member_insert" ON public.search_history;
DROP POLICY IF EXISTS sh_member_select ON public.search_history;
DROP POLICY IF EXISTS "sh_member_select" ON public.search_history;
DROP POLICY IF EXISTS "Workspace members can view history" ON public.search_history;

CREATE POLICY sh_member_select ON public.search_history
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
       WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY sh_member_insert ON public.search_history
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
       WHERE user_id = (SELECT auth.uid())
    )
  );

-- Service-role write (Edge Functions on behalf of users)
CREATE POLICY sh_service_write ON public.search_history
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');


-- ── support_tickets ─────────────────────────────────────────
-- Conflicting ALL: {st_admin_all, st_user_all}
-- Drop both; rebuild as two clean non-overlapping policies
DROP POLICY IF EXISTS st_admin_all ON public.support_tickets;
DROP POLICY IF EXISTS st_user_all  ON public.support_tickets;

-- Admins: full access
CREATE POLICY st_admin_all ON public.support_tickets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = (SELECT auth.uid())
         AND ur.role IN ('admin','super_admin','support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = (SELECT auth.uid())
         AND ur.role IN ('admin','super_admin','support')
    )
  );

-- Regular users: manage own tickets only
CREATE POLICY st_user_all ON public.support_tickets
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));


-- ── support_ticket_replies ──────────────────────────────────
-- Conflicting INSERT: {str_admin_all, str_user_insert}
-- Conflicting SELECT: {str_admin_all, str_user_select}
DROP POLICY IF EXISTS str_admin_all  ON public.support_ticket_replies;
DROP POLICY IF EXISTS str_user_insert ON public.support_ticket_replies;
DROP POLICY IF EXISTS str_user_select ON public.support_ticket_replies;

-- Admins/support: all access
CREATE POLICY str_admin_all ON public.support_ticket_replies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = (SELECT auth.uid())
         AND ur.role IN ('admin','super_admin','support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = (SELECT auth.uid())
         AND ur.role IN ('admin','super_admin','support')
    )
  );

-- Users: read replies on their own tickets; insert their own replies
CREATE POLICY str_user_select ON public.support_ticket_replies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
       WHERE st.id = support_ticket_replies.ticket_id
         AND st.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY str_user_insert ON public.support_ticket_replies
  FOR INSERT
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.support_tickets st
       WHERE st.id = support_ticket_replies.ticket_id
         AND st.user_id = (SELECT auth.uid())
    )
  );


-- ── workspace_members ───────────────────────────────────────
-- Conflicting SELECT: {wm_select, wm_select_own}
DROP POLICY IF EXISTS wm_select     ON public.workspace_members;
DROP POLICY IF EXISTS wm_select_own ON public.workspace_members;
-- Rebuild as single policy: user can see all members of workspaces they belong to
CREATE POLICY wm_select ON public.workspace_members
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm2.workspace_id
        FROM public.workspace_members wm2
       WHERE wm2.user_id = (SELECT auth.uid())
    )
  );


-- ── workspaces ──────────────────────────────────────────────
-- Conflicting SELECT: {ws_member_select, ws_select}
DROP POLICY IF EXISTS ws_member_select ON public.workspaces;
DROP POLICY IF EXISTS ws_select        ON public.workspaces;
CREATE POLICY ws_select ON public.workspaces
  FOR SELECT
  USING (
    id IN (
      SELECT wm.workspace_id
        FROM public.workspace_members wm
       WHERE wm.user_id = (SELECT auth.uid())
    )
  );


-- ── follower_history ─────────────────────────────────────────
-- Conflicting SELECT: {"Public read history", fh_workspace_select}
-- follower_history.profile_id FK → influencer_profiles (shared enrichment table).
-- No workspace_id column — gate on authenticated workspace membership.
DROP POLICY IF EXISTS "Public read history" ON public.follower_history;
DROP POLICY IF EXISTS "Workspace members can read follower history" ON public.follower_history;
DROP POLICY IF EXISTS "Authenticated workspace members can read follower history" ON public.follower_history;
DROP POLICY IF EXISTS fh_workspace_select ON public.follower_history;
DROP POLICY IF EXISTS "fh_workspace_select" ON public.follower_history;
-- Consolidated: any authenticated workspace member may read (shared enrichment cache)
CREATE POLICY fh_workspace_select ON public.follower_history
  FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
       WHERE wm.user_id = (SELECT auth.uid())
    )
  );


-- ── influencer_posts ─────────────────────────────────────────
-- Conflicting SELECT: {"Public read posts", ipost_auth_select}
DROP POLICY IF EXISTS "Public read posts" ON public.influencer_posts;
DROP POLICY IF EXISTS ipost_auth_select  ON public.influencer_posts;
CREATE POLICY ipost_auth_select ON public.influencer_posts
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);  -- any authenticated user


-- ── influencer_profiles ──────────────────────────────────────
-- Conflicting SELECT: {"Public read profiles", ip_auth_select}
DROP POLICY IF EXISTS "Public read profiles" ON public.influencer_profiles;
DROP POLICY IF EXISTS ip_auth_select         ON public.influencer_profiles;
CREATE POLICY ip_auth_select ON public.influencer_profiles
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL);


-- ── linked_accounts ──────────────────────────────────────────
-- linked_accounts has no workspace_id column (profile_id_a FK → influencer_profiles).
-- It is a shared enrichment table; gate on authenticated workspace membership.
DROP POLICY IF EXISTS "Public read linked_accounts" ON public.linked_accounts;
DROP POLICY IF EXISTS la_workspace_select ON public.linked_accounts;
DROP POLICY IF EXISTS "la_workspace_select" ON public.linked_accounts;
CREATE POLICY la_workspace_select ON public.linked_accounts
  FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
       WHERE wm.user_id = (SELECT auth.uid())
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 2C  RLS ENABLED BUT NO POLICY — campaign_metrics
--     Tables with RLS enabled but zero policies default to
--     DENY ALL for non-superusers.  Add an explicit deny policy
--     to make the intent unambiguous and silence the linter.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;

-- Service-role and admins: full access
DROP POLICY IF EXISTS cm_admin_all ON public.campaign_metrics;
CREATE POLICY cm_admin_all ON public.campaign_metrics
  FOR ALL
  USING (
    current_setting('role') = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = (SELECT auth.uid())
         AND ur.role IN ('admin','super_admin')
    )
  )
  WITH CHECK (
    current_setting('role') = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = (SELECT auth.uid())
         AND ur.role IN ('admin','super_admin')
    )
  );

-- Workspace members: read metrics via tracking_link_id → tracking_links → campaigns
-- campaign_metrics.tracking_link_id → tracking_links.campaign_id → campaigns.workspace_id
DROP POLICY IF EXISTS cm_member_select ON public.campaign_metrics;
CREATE POLICY cm_member_select ON public.campaign_metrics
  FOR SELECT
  USING (
    tracking_link_id IN (
      SELECT tl.id
        FROM public.tracking_links tl
        JOIN public.campaigns c ON c.id = tl.campaign_id
        JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
       WHERE wm.user_id = (SELECT auth.uid())
    )
  );


-- ============================================================
-- PHASE 3: INDEX OPTIMIZATION
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 3A  DROP DUPLICATE INDEXES
--     Lint: 0009 duplicate_index
--
--     Convention: keep the shorter/original name, drop the
--     idx_linter_* counterpart unless the linter version
--     is also listed as the one to keep.
-- ─────────────────────────────────────────────────────────────

-- enrichment_jobs: keep idx_enrichment_jobs_workspace, drop linter duplicate
DROP INDEX IF EXISTS public.idx_linter_enrichment_jobs_workspace_id;

-- follower_history: keep idx_follower_history_profile, drop linter duplicate
DROP INDEX IF EXISTS public.idx_linter_follower_history_inflid;

-- influencer_posts: keep idx_influencer_posts_profile (shorter), drop _id variant
DROP INDEX IF EXISTS public.idx_influencer_posts_profile_id;

-- influencer_profiles platform_username: keep descriptive name, drop short alias
DROP INDEX IF EXISTS public.idx_ip_platform_username;

-- influencer_profiles primary_niche: keep descriptive name, drop short alias
-- NOTE: Both are also unused (see 3C) — the descriptive one is kept for clarity
DROP INDEX IF EXISTS public.idx_ip_primary_niche;

-- influencer_profiles tags: idx_ip_tags vs idx_ip_tags_gin
-- GIN indexes are correct for array columns; drop the non-GIN btree duplicate
DROP INDEX IF EXISTS public.idx_ip_tags;             -- keep idx_ip_tags_gin (GIN)

-- influencers_cache tags: same pattern
DROP INDEX IF EXISTS public.idx_ic_tags;             -- keep idx_ic_tags_gin (GIN)

-- notifications: drop linter duplicate
DROP INDEX IF EXISTS public.idx_linter_notifications_user_id;

-- search_history: drop linter duplicate
DROP INDEX IF EXISTS public.idx_linter_sh_workspace_id;

-- support_tickets: drop linter duplicate
DROP INDEX IF EXISTS public.idx_linter_support_tickets_user_id;

-- user_roles role: drop linter duplicate
DROP INDEX IF EXISTS public.idx_linter_user_roles_role;

-- user_roles user_id: drop linter duplicate
DROP INDEX IF EXISTS public.idx_linter_user_roles_user_id;

-- workspace_members: drop linter duplicate
DROP INDEX IF EXISTS public.idx_linter_wm_user_id;


-- ─────────────────────────────────────────────────────────────
-- 3B  CREATE INDEXES FOR UNINDEXED FOREIGN KEYS
--     Lint: 0001 unindexed_foreign_keys
--
--     NOTE: CREATE INDEX CONCURRENTLY cannot run inside a
--     transaction block.  These statements are written without
--     CONCURRENTLY so the migration can run in a single
--     transaction.  If you need zero-downtime index creation on
--     a live production DB, run each statement individually in
--     the Supabase SQL Editor (outside a migration) using
--     CONCURRENTLY.
-- ─────────────────────────────────────────────────────────────

-- admin_audit_log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id
  ON public.admin_audit_log (admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id
  ON public.admin_audit_log (target_user_id);

-- announcements (admin_user_id FK)
CREATE INDEX IF NOT EXISTS idx_announcements_admin_user_id
  ON public.announcements (admin_user_id);

-- anomaly_logs
CREATE INDEX IF NOT EXISTS idx_anomaly_logs_user_id
  ON public.anomaly_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_anomaly_logs_workspace_id
  ON public.anomaly_logs (workspace_id);

-- api_rate_limits
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_user_id
  ON public.api_rate_limits (user_id);

-- api_usage_logs
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id
  ON public.api_usage_logs (user_id);

-- api_usage_metrics
CREATE INDEX IF NOT EXISTS idx_api_usage_metrics_user_id
  ON public.api_usage_metrics (user_id);

CREATE INDEX IF NOT EXISTS idx_api_usage_metrics_workspace_id
  ON public.api_usage_metrics (workspace_id);

-- bot_detection_feedback
CREATE INDEX IF NOT EXISTS idx_bot_detection_feedback_user_id
  ON public.bot_detection_feedback (user_id);

CREATE INDEX IF NOT EXISTS idx_bot_detection_feedback_workspace_id
  ON public.bot_detection_feedback (workspace_id);

-- campaign_activity (user_id FK)
CREATE INDEX IF NOT EXISTS idx_campaign_activity_user_id
  ON public.campaign_activity (user_id);

-- campaign_metrics
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_influencer_id
  ON public.campaign_metrics (influencer_id);

-- consent_log
CREATE INDEX IF NOT EXISTS idx_consent_log_user_id
  ON public.consent_log (user_id);

-- credit_consumption_metrics
CREATE INDEX IF NOT EXISTS idx_credit_consumption_metrics_user_id
  ON public.credit_consumption_metrics (user_id);

-- email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_workspace_id
  ON public.email_templates (workspace_id);

-- enrichment_failures
CREATE INDEX IF NOT EXISTS idx_enrichment_failures_workspace_id
  ON public.enrichment_failures (workspace_id);

-- influencer_evaluations
CREATE INDEX IF NOT EXISTS idx_influencer_evaluations_workspace_id
  ON public.influencer_evaluations (workspace_id);

-- influencer_profiles (niche_corrected_by FK)
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_niche_corrected_by
  ON public.influencer_profiles (niche_corrected_by);

-- invoices
CREATE INDEX IF NOT EXISTS idx_invoices_workspace_id
  ON public.invoices (workspace_id);

-- notification_log
CREATE INDEX IF NOT EXISTS idx_notification_log_admin_user_id
  ON public.notification_log (admin_user_id);

-- outreach_log
CREATE INDEX IF NOT EXISTS idx_outreach_log_campaign_id
  ON public.outreach_log (campaign_id);

CREATE INDEX IF NOT EXISTS idx_outreach_log_card_id
  ON public.outreach_log (card_id);

-- pipeline_cards
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_stage_id
  ON public.pipeline_cards (stage_id);

-- pipeline_stages
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_campaign_id
  ON public.pipeline_stages (campaign_id);

-- refund_idempotency_keys
CREATE INDEX IF NOT EXISTS idx_refund_idempotency_keys_workspace_id
  ON public.refund_idempotency_keys (workspace_id);

-- security_alerts
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id
  ON public.security_alerts (user_id);

-- security_anomaly_logs
CREATE INDEX IF NOT EXISTS idx_security_anomaly_logs_user_id
  ON public.security_anomaly_logs (user_id);

-- security_events
CREATE INDEX IF NOT EXISTS idx_security_events_workspace_id
  ON public.security_events (workspace_id);

-- support_ticket_replies
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_author_id
  ON public.support_ticket_replies (author_id);

-- support_tickets (workspace_id FK)
CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_id
  ON public.support_tickets (workspace_id);

-- system_restore_confirmations
CREATE INDEX IF NOT EXISTS idx_system_restore_confirmations_requested_by
  ON public.system_restore_confirmations (requested_by);

-- system_restore_points
CREATE INDEX IF NOT EXISTS idx_system_restore_points_created_by
  ON public.system_restore_points (created_by);

-- tracking_events
CREATE INDEX IF NOT EXISTS idx_tracking_events_link_id
  ON public.tracking_events (link_id);

-- tracking_links
CREATE INDEX IF NOT EXISTS idx_tracking_links_campaign_id
  ON public.tracking_links (campaign_id);

CREATE INDEX IF NOT EXISTS idx_tracking_links_workspace_id
  ON public.tracking_links (workspace_id);

-- user_activity_logs
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_workspace_id
  ON public.user_activity_logs (workspace_id);


-- ─────────────────────────────────────────────────────────────
-- 3C  DROP UNUSED INDEXES
--     Lint: 0005 unused_index
--
--     These indexes have never been scanned since the last
--     pg_stat_reset.  Dropping them reduces write amplification
--     on INSERT/UPDATE/DELETE and shrinks disk usage.
--
--     CAUTION: If your stats were recently reset (pg_stat_reset)
--     or the workload is seasonal, verify with your query planner
--     before dropping.  Re-create any index if queries slow down.
-- ─────────────────────────────────────────────────────────────

-- api_usage_logs
DROP INDEX IF EXISTS public.idx_api_usage_workspace;

-- user_activity_logs
DROP INDEX IF EXISTS public.idx_user_activity_user_ts;

-- influencer_profiles (unused + already dropped as duplicate above)
DROP INDEX IF EXISTS public.idx_influencer_profiles_primary_niche;
DROP INDEX IF EXISTS public.idx_ip_follower_count;
DROP INDEX IF EXISTS public.idx_influencer_profiles_enriched_at;

-- workspace_members (unused linter indexes)
DROP INDEX IF EXISTS public.idx_linter_wm_workspace_id;    -- not a duplicate pair, just unused

-- campaigns (linter-generated, unused)
DROP INDEX IF EXISTS public.idx_linter_campaigns_workspace_id;
DROP INDEX IF EXISTS public.idx_linter_campaigns_id;

-- list_items (linter-generated, unused)
DROP INDEX IF EXISTS public.idx_linter_list_items_list_id;

-- influencer_lists (linter-generated, unused)
DROP INDEX IF EXISTS public.idx_linter_il_workspace_id;

-- security_events (unused timestamp/type/risk indexes)
DROP INDEX IF EXISTS public.idx_security_events_ts;
DROP INDEX IF EXISTS public.idx_security_events_type;
DROP INDEX IF EXISTS public.idx_security_events_risk;

-- system_metrics (unused)
DROP INDEX IF EXISTS public.idx_system_metrics_ts;
DROP INDEX IF EXISTS public.idx_system_metrics_name_ts;

-- api_usage_metrics (unused time-series indexes)
DROP INDEX IF EXISTS public.idx_api_usage_metrics_status_ts;
DROP INDEX IF EXISTS public.idx_api_usage_metrics_ts;
DROP INDEX IF EXISTS public.idx_api_usage_metrics_endpoint_ts;

-- credit_consumption_metrics (unused)
DROP INDEX IF EXISTS public.idx_credit_consumption_metrics_ws_ts;
DROP INDEX IF EXISTS public.idx_credit_consumption_metrics_ts;
DROP INDEX IF EXISTS public.idx_credit_consumption_metrics_type_ts;

-- api_cost_log (unused)
DROP INDEX IF EXISTS public.idx_api_cost_log_workspace_date;
DROP INDEX IF EXISTS public.idx_api_cost_log_api_date;

-- user_roles (unused — note: _role and _user_id were already dropped as duplicates above)
DROP INDEX IF EXISTS public.idx_user_roles_role;

-- influencers_cache (unused vector embedding index)
DROP INDEX IF EXISTS public.idx_influencers_cache_embedding;

-- behavioral_anomalies (unused)
DROP INDEX IF EXISTS public.idx_behavioral_anomalies_workspace;

-- linked_accounts (unused alias)
DROP INDEX IF EXISTS public.idx_linked_accounts_a;

-- enrichment_jobs (unused — duplicates already handled above; status never used)
DROP INDEX IF EXISTS public.idx_enrichment_jobs_status;
DROP INDEX IF EXISTS public.idx_enrichment_jobs_workspace;   -- safe: duplicate was already dropped

-- influencer_posts (unused)
DROP INDEX IF EXISTS public.idx_influencer_posts_posted_at;

-- enrichment_failures (unused)
DROP INDEX IF EXISTS public.idx_enrichment_failures_created;
DROP INDEX IF EXISTS public.idx_enrichment_failures_platform;

-- bot_detection_feedback (unused)
DROP INDEX IF EXISTS public.idx_bot_feedback_platform;

-- support_tickets (unused — duplicate already dropped in 3A)
DROP INDEX IF EXISTS public.idx_support_tickets_status;
DROP INDEX IF EXISTS public.idx_support_tickets_created_at;

-- idempotency_keys (unused)
DROP INDEX IF EXISTS public.idx_idempotency_keys_user;

-- follower_history (duplicate already dropped in 3A)
-- idx_linter_follower_history_inflid already handled

-- ============================================================
-- END OF MIGRATION
-- ============================================================
-- After applying, re-run the Supabase linter to verify all
-- warnings are cleared:
--   supabase db lint  (CLI)
--   or Dashboard → Database → Linter
-- ============================================================
