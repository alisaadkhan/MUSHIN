-- ============================================================
-- Migration: 20260416_linter_remediation_v2.sql
-- Purpose  : Full Supabase linter remediation pass 2
--   1. auth_users_exposed    → revoke anon/authenticated from admin views
--   2. function_search_path_mutable → SET search_path='' on all functions
--   3. rls_policy_always_true → restrict service_role policies to service_role
--   4. rls_enabled_no_policy  → add policy for campaign_metrics
--   5. auth_rls_initplan      → wrap auth.uid() in (SELECT ...) for 80+ policies
--   6. multiple_permissive_policies → consolidate duplicate policies
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PART 1: auth_users_exposed
-- Revoke anon and authenticated access to admin views that
-- join against auth.users. Only super_admin/service_role should
-- be able to call these via PostgREST.
-- ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  -- admin_user_activity_view
  EXECUTE 'REVOKE SELECT ON public.admin_user_activity_view FROM anon, authenticated';
  -- admin_workspace_activity_view
  EXECUTE 'REVOKE SELECT ON public.admin_workspace_activity_view FROM anon, authenticated';
  -- admin_credit_history_view
  EXECUTE 'REVOKE SELECT ON public.admin_credit_history_view FROM anon, authenticated';
  -- super_admin_user_overview
  EXECUTE 'REVOKE SELECT ON public.super_admin_user_overview FROM anon, authenticated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'auth_users_exposed revoke skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- PART 2: security_definer_view — set security_invoker on ALL views
-- (Belt-and-suspenders: covers any not handled by previous migration)
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE v record;
BEGIN
  FOR v IN
    SELECT table_name FROM information_schema.views WHERE table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v.table_name);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'security_invoker skip %: %', v.table_name, SQLERRM;
    END;
  END LOOP;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- PART 3: function_search_path_mutable
-- Add SET search_path = '' to every affected function.
-- We use CREATE OR REPLACE to preserve the body exactly.
-- ─────────────────────────────────────────────────────────────

-- Helper: apply search_path to all existing public functions safely
DO $$
DECLARE
  func_rec record;
  func_oid oid;
BEGIN
  FOR func_rec IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS src
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')   -- functions and procedures
      AND NOT EXISTS (
        SELECT 1 FROM pg_options_to_table(p.proconfig)
        WHERE option_name = 'search_path'
      )
  LOOP
    BEGIN
      -- Set search_path on the function without rewriting the body
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = ''''',
        func_rec.oid::regprocedure
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'search_path skip for %: %', func_rec.proname, SQLERRM;
    END;
  END LOOP;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- PART 4: rls_policy_always_true
-- Service-role policies with USING(true)/WITH CHECK(true) are
-- intentional for backend operations, but must be restricted
-- to the service_role so anon/authenticated cannot exploit them.
-- We recreate these with TO service_role.
-- ─────────────────────────────────────────────────────────────

-- admin_audit_log: service role can insert audit log
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "service role can insert audit log" ON public.admin_audit_log';
  EXECUTE $q$
    CREATE POLICY "service role can insert audit log"
    ON public.admin_audit_log FOR INSERT
    TO service_role
    WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'admin_audit_log service policy skip: %', SQLERRM;
END; $$;
-- api_usage_logs: Service role full access api_usage
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Service role full access api_usage" ON public.api_usage_logs';
  EXECUTE $q$
    CREATE POLICY "Service role full access api_usage"
    ON public.api_usage_logs FOR ALL
    TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'api_usage_logs service policy skip: %', SQLERRM;
END; $$;
-- notification_log: Service insert notification log
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Service insert notification log" ON public.notification_log';
  EXECUTE $q$
    CREATE POLICY "Service insert notification log"
    ON public.notification_log FOR INSERT
    TO service_role
    WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notification_log service policy skip: %', SQLERRM;
END; $$;
-- notifications: Service role inserts notifications
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Service role inserts notifications" ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS "notif_service_write" ON public.notifications';
  EXECUTE $q$
    CREATE POLICY "notif_service_write"
    ON public.notifications FOR ALL
    TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notifications service policy skip: %', SQLERRM;
END; $$;
-- refund_idempotency_keys: Service role full access idempotency
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Service role full access idempotency" ON public.refund_idempotency_keys';
  EXECUTE $q$
    CREATE POLICY "Service role full access idempotency"
    ON public.refund_idempotency_keys FOR ALL
    TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'refund_idempotency_keys service policy skip: %', SQLERRM;
END; $$;
-- user_activity_logs: Service role full access user_activity
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Service role full access user_activity" ON public.user_activity_logs';
  EXECUTE $q$
    CREATE POLICY "Service role full access user_activity"
    ON public.user_activity_logs FOR ALL
    TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'user_activity_logs service policy skip: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- PART 5a: campaign_metrics — RLS enabled but no policy
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Grant read to workspace members, write to service_role
  EXECUTE 'DROP POLICY IF EXISTS "cm_workspace_select" ON public.campaign_metrics';
  EXECUTE 'DROP POLICY IF EXISTS "cm_service_write" ON public.campaign_metrics';

  EXECUTE $q$
    CREATE POLICY "cm_workspace_select" ON public.campaign_metrics
    FOR SELECT USING (
      campaign_id IN (
        SELECT id FROM public.campaigns WHERE workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
    )
  $q$;
  EXECUTE $q$
    CREATE POLICY "cm_service_write" ON public.campaign_metrics
    FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'campaign_metrics policy skip: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- PART 5b: auth_rls_initplan — remaining 80+ tables
-- Pattern: replace auth.uid() with (SELECT auth.uid())
-- Strategy: DROP all old + CREATE consolidated policies
-- ─────────────────────────────────────────────────────────────

-- outreach_log
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view outreach" ON public.outreach_log';
  EXECUTE 'DROP POLICY IF EXISTS "ol_member_insert" ON public.outreach_log';
  EXECUTE 'DROP POLICY IF EXISTS "ol_member_update" ON public.outreach_log';
  EXECUTE 'DROP POLICY IF EXISTS "ol_service_write" ON public.outreach_log';
  EXECUTE $q$
    CREATE POLICY "ol_member_select" ON public.outreach_log FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.campaigns c JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id WHERE c.id = outreach_log.campaign_id AND wm.user_id = (SELECT auth.uid())))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ol_member_insert" ON public.outreach_log FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns c JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id WHERE c.id = campaign_id AND wm.user_id = (SELECT auth.uid())))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ol_member_update" ON public.outreach_log FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.campaigns c JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id WHERE c.id = campaign_id AND wm.user_id = (SELECT auth.uid())))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ol_service_write" ON public.outreach_log FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'outreach_log skip: %', SQLERRM; END; $$;
-- email_templates
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage templates" ON public.email_templates';
  EXECUTE 'DROP POLICY IF EXISTS "et_member_all" ON public.email_templates';
  EXECUTE $q$
    CREATE POLICY "et_member_all" ON public.email_templates FOR ALL
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))
    WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'email_templates skip: %', SQLERRM; END; $$;
-- user_roles
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles';
  EXECUTE 'DROP POLICY IF EXISTS "ur_service_write" ON public.user_roles';
  EXECUTE 'DROP POLICY IF EXISTS "ur_self_select" ON public.user_roles';
  EXECUTE $q$
    CREATE POLICY "ur_self_select" ON public.user_roles FOR SELECT
    USING (user_id = (SELECT auth.uid()))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ur_service_write" ON public.user_roles FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'user_roles skip: %', SQLERRM; END; $$;
-- subscriptions
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Owner can read subscription" ON public.subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "sub_service_write" ON public.subscriptions';
  EXECUTE 'DROP POLICY IF EXISTS "sub_owner_select" ON public.subscriptions';
  EXECUTE $q$
    CREATE POLICY "sub_owner_select" ON public.subscriptions FOR SELECT
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid()) AND role = 'owner'))
  $q$;
  EXECUTE $q$
    CREATE POLICY "sub_service_write" ON public.subscriptions FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'subscriptions skip: %', SQLERRM; END; $$;
-- influencer_evaluations
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can read evaluations" ON public.influencer_evaluations';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view evaluations" ON public.influencer_evaluations';
  EXECUTE 'DROP POLICY IF EXISTS "Service role manages evaluations" ON public.influencer_evaluations';
  EXECUTE 'DROP POLICY IF EXISTS "ie_member_select" ON public.influencer_evaluations';
  EXECUTE 'DROP POLICY IF EXISTS "ie_service_write" ON public.influencer_evaluations';
  EXECUTE $q$
    CREATE POLICY "ie_member_select" ON public.influencer_evaluations FOR SELECT
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ie_service_write" ON public.influencer_evaluations FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'influencer_evaluations skip: %', SQLERRM; END; $$;
-- api_cost_log
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can read own costs" ON public.api_cost_log';
  EXECUTE 'DROP POLICY IF EXISTS "Service role manages cost log" ON public.api_cost_log';
  EXECUTE 'DROP POLICY IF EXISTS "acl_member_select" ON public.api_cost_log';
  EXECUTE 'DROP POLICY IF EXISTS "acl_service_write" ON public.api_cost_log';
  EXECUTE $q$
    CREATE POLICY "acl_member_select" ON public.api_cost_log FOR SELECT
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))
  $q$;
  EXECUTE $q$
    CREATE POLICY "acl_service_write" ON public.api_cost_log FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'api_cost_log skip: %', SQLERRM; END; $$;
-- behavioral_anomalies
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins can read anomalies" ON public.behavioral_anomalies';
  EXECUTE 'DROP POLICY IF EXISTS "Service role manages anomalies" ON public.behavioral_anomalies';
  EXECUTE 'DROP POLICY IF EXISTS "ba_admin_select" ON public.behavioral_anomalies';
  EXECUTE 'DROP POLICY IF EXISTS "ba_service_write" ON public.behavioral_anomalies';
  EXECUTE $q$
    CREATE POLICY "ba_admin_select" ON public.behavioral_anomalies FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ba_service_write" ON public.behavioral_anomalies FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'behavioral_anomalies skip: %', SQLERRM; END; $$;
-- consent_log
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can read own consent" ON public.consent_log';
  EXECUTE 'DROP POLICY IF EXISTS "Service role manages consent" ON public.consent_log';
  EXECUTE 'DROP POLICY IF EXISTS "cl_self_select" ON public.consent_log';
  EXECUTE 'DROP POLICY IF EXISTS "cl_service_write" ON public.consent_log';
  EXECUTE $q$
    CREATE POLICY "cl_self_select" ON public.consent_log FOR SELECT
    USING (user_id = (SELECT auth.uid()))
  $q$;
  EXECUTE $q$
    CREATE POLICY "cl_service_write" ON public.consent_log FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'consent_log skip: %', SQLERRM; END; $$;
-- engagement_benchmarks
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read benchmarks" ON public.engagement_benchmarks';
  EXECUTE 'DROP POLICY IF EXISTS "Service role manages benchmarks" ON public.engagement_benchmarks';
  EXECUTE 'DROP POLICY IF EXISTS "eb_auth_select" ON public.engagement_benchmarks';
  EXECUTE 'DROP POLICY IF EXISTS "eb_service_write" ON public.engagement_benchmarks';
  EXECUTE $q$
    CREATE POLICY "eb_auth_select" ON public.engagement_benchmarks FOR SELECT
    USING ((SELECT auth.uid()) IS NOT NULL)
  $q$;
  EXECUTE $q$
    CREATE POLICY "eb_service_write" ON public.engagement_benchmarks FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'engagement_benchmarks skip: %', SQLERRM; END; $$;
-- enrichment_failures
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins can read failures" ON public.enrichment_failures';
  EXECUTE 'DROP POLICY IF EXISTS "Service role manages failures" ON public.enrichment_failures';
  EXECUTE 'DROP POLICY IF EXISTS "ef_admin_select" ON public.enrichment_failures';
  EXECUTE 'DROP POLICY IF EXISTS "ef_service_write" ON public.enrichment_failures';
  EXECUTE $q$
    CREATE POLICY "ef_admin_select" ON public.enrichment_failures FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ef_service_write" ON public.enrichment_failures FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enrichment_failures skip: %', SQLERRM; END; $$;
-- bot_detection_feedback
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated can submit bot feedback" ON public.bot_detection_feedback';
  EXECUTE 'DROP POLICY IF EXISTS "Admins read bot feedback" ON public.bot_detection_feedback';
  EXECUTE 'DROP POLICY IF EXISTS "bdf_auth_insert" ON public.bot_detection_feedback';
  EXECUTE 'DROP POLICY IF EXISTS "bdf_admin_select" ON public.bot_detection_feedback';
  EXECUTE $q$
    CREATE POLICY "bdf_auth_insert" ON public.bot_detection_feedback FOR INSERT
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  $q$;
  EXECUTE $q$
    CREATE POLICY "bdf_admin_select" ON public.bot_detection_feedback FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'bot_detection_feedback skip: %', SQLERRM; END; $$;
-- workspace_secrets
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace owners can manage secrets" ON public.workspace_secrets';
  EXECUTE 'DROP POLICY IF EXISTS "ws_owner_all" ON public.workspace_secrets';
  EXECUTE $q$
    CREATE POLICY "ws_owner_all" ON public.workspace_secrets FOR ALL
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid()) AND role = 'owner'))
    WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid()) AND role = 'owner'))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'workspace_secrets skip: %', SQLERRM; END; $$;
-- tracking_links
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage tracking links" ON public.tracking_links';
  EXECUTE 'DROP POLICY IF EXISTS "tl_member_all" ON public.tracking_links';
  EXECUTE $q$
    CREATE POLICY "tl_member_all" ON public.tracking_links FOR ALL
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))
    WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'tracking_links skip: %', SQLERRM; END; $$;
-- invoices
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace owners can view invoices" ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS "inv_service_write" ON public.invoices';
  EXECUTE 'DROP POLICY IF EXISTS "inv_owner_select" ON public.invoices';
  EXECUTE $q$
    CREATE POLICY "inv_owner_select" ON public.invoices FOR SELECT
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid()) AND role = 'owner'))
  $q$;
  EXECUTE $q$
    CREATE POLICY "inv_service_write" ON public.invoices FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'invoices skip: %', SQLERRM; END; $$;
-- admin_audit_log (select policy)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "super_admin can view audit log" ON public.admin_audit_log';
  EXECUTE 'DROP POLICY IF EXISTS "aal_super_admin_select" ON public.admin_audit_log';
  EXECUTE $q$
    CREATE POLICY "aal_super_admin_select" ON public.admin_audit_log FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role = 'super_admin'))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'admin_audit_log select skip: %', SQLERRM; END; $$;
-- influencer_profiles
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.influencer_profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Service role manages profiles" ON public.influencer_profiles';
  EXECUTE 'DROP POLICY IF EXISTS "ip_auth_select" ON public.influencer_profiles';
  EXECUTE 'DROP POLICY IF EXISTS "ip_service_write" ON public.influencer_profiles';
  EXECUTE $q$
    CREATE POLICY "ip_auth_select" ON public.influencer_profiles FOR SELECT
    USING ((SELECT auth.uid()) IS NOT NULL)
  $q$;
  EXECUTE $q$
    CREATE POLICY "ip_service_write" ON public.influencer_profiles FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'influencer_profiles skip: %', SQLERRM; END; $$;
-- influencer_posts
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read posts" ON public.influencer_posts';
  EXECUTE 'DROP POLICY IF EXISTS "Service role manages posts" ON public.influencer_posts';
  EXECUTE 'DROP POLICY IF EXISTS "ipost_auth_select" ON public.influencer_posts';
  EXECUTE 'DROP POLICY IF EXISTS "ipost_service_write" ON public.influencer_posts';
  EXECUTE $q$
    CREATE POLICY "ipost_auth_select" ON public.influencer_posts FOR SELECT
    USING ((SELECT auth.uid()) IS NOT NULL)
  $q$;
  EXECUTE $q$
    CREATE POLICY "ipost_service_write" ON public.influencer_posts FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'influencer_posts skip: %', SQLERRM; END; $$;
-- system_backup_runs
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "system_backup_runs_read_admin" ON public.system_backup_runs';
  EXECUTE 'DROP POLICY IF EXISTS "system_backup_runs_service_write" ON public.system_backup_runs';
  EXECUTE 'DROP POLICY IF EXISTS "sbr_admin_select" ON public.system_backup_runs';
  EXECUTE 'DROP POLICY IF EXISTS "sbr_service_write" ON public.system_backup_runs';
  EXECUTE $q$
    CREATE POLICY "sbr_admin_select" ON public.system_backup_runs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
  EXECUTE $q$
    CREATE POLICY "sbr_service_write" ON public.system_backup_runs FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'system_backup_runs skip: %', SQLERRM; END; $$;
-- user_activity_logs (admin select)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "System admins can read user_activity" ON public.user_activity_logs';
  EXECUTE 'DROP POLICY IF EXISTS "ual_admin_select" ON public.user_activity_logs';
  EXECUTE $q$
    CREATE POLICY "ual_admin_select" ON public.user_activity_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'user_activity_logs admin select skip: %', SQLERRM; END; $$;
-- api_usage_logs (admin select)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "System admins can read api_usage" ON public.api_usage_logs';
  EXECUTE 'DROP POLICY IF EXISTS "aul_admin_select" ON public.api_usage_logs';
  EXECUTE $q$
    CREATE POLICY "aul_admin_select" ON public.api_usage_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'api_usage_logs admin select skip: %', SQLERRM; END; $$;
-- support_tickets
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users manage own tickets" ON public.support_tickets';
  EXECUTE 'DROP POLICY IF EXISTS "Admins manage all tickets" ON public.support_tickets';
  EXECUTE 'DROP POLICY IF EXISTS "st_user_all" ON public.support_tickets';
  EXECUTE 'DROP POLICY IF EXISTS "st_admin_all" ON public.support_tickets';
  EXECUTE $q$
    CREATE POLICY "st_user_all" ON public.support_tickets FOR ALL
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()))
  $q$;
  EXECUTE $q$
    CREATE POLICY "st_admin_all" ON public.support_tickets FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'support_tickets skip: %', SQLERRM; END; $$;
-- system_audit_logs
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "system_audit_logs_select_system_admin" ON public.system_audit_logs';
  EXECUTE 'DROP POLICY IF EXISTS "system_audit_logs_insert_service_role" ON public.system_audit_logs';
  EXECUTE 'DROP POLICY IF EXISTS "sal_admin_select" ON public.system_audit_logs';
  EXECUTE 'DROP POLICY IF EXISTS "sal_service_insert" ON public.system_audit_logs';
  EXECUTE $q$
    CREATE POLICY "sal_admin_select" ON public.system_audit_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
  EXECUTE $q$
    CREATE POLICY "sal_service_insert" ON public.system_audit_logs FOR INSERT
    TO service_role WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'system_audit_logs skip: %', SQLERRM; END; $$;
-- system_restore_points
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "system_restore_points_select_admin" ON public.system_restore_points';
  EXECUTE 'DROP POLICY IF EXISTS "srp_admin_select" ON public.system_restore_points';
  EXECUTE $q$
    CREATE POLICY "srp_admin_select" ON public.system_restore_points FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'system_restore_points skip: %', SQLERRM; END; $$;
-- system_restore_confirmations
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "system_restore_confirmations_select_admin" ON public.system_restore_confirmations';
  EXECUTE 'DROP POLICY IF EXISTS "src_admin_select" ON public.system_restore_confirmations';
  EXECUTE $q$
    CREATE POLICY "src_admin_select" ON public.system_restore_confirmations FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'system_restore_confirmations skip: %', SQLERRM; END; $$;
-- support_ticket_replies
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users see replies on own tickets" ON public.support_ticket_replies';
  EXECUTE 'DROP POLICY IF EXISTS "Users reply to own tickets" ON public.support_ticket_replies';
  EXECUTE 'DROP POLICY IF EXISTS "Admins manage all replies" ON public.support_ticket_replies';
  EXECUTE 'DROP POLICY IF EXISTS "str_user_select" ON public.support_ticket_replies';
  EXECUTE 'DROP POLICY IF EXISTS "str_user_insert" ON public.support_ticket_replies';
  EXECUTE 'DROP POLICY IF EXISTS "str_admin_all" ON public.support_ticket_replies';
  EXECUTE $q$
    CREATE POLICY "str_user_select" ON public.support_ticket_replies FOR SELECT
    USING (ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = (SELECT auth.uid())))
  $q$;
  EXECUTE $q$
    CREATE POLICY "str_user_insert" ON public.support_ticket_replies FOR INSERT
    WITH CHECK (ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = (SELECT auth.uid())))
  $q$;
  EXECUTE $q$
    CREATE POLICY "str_admin_all" ON public.support_ticket_replies FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'support_ticket_replies skip: %', SQLERRM; END; $$;
-- notifications (user policies)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS "notif_own_select" ON public.notifications';
  EXECUTE 'DROP POLICY IF EXISTS "notif_own_update" ON public.notifications';
  EXECUTE $q$
    CREATE POLICY "notif_own_select" ON public.notifications FOR SELECT
    USING (user_id = (SELECT auth.uid()))
  $q$;
  EXECUTE $q$
    CREATE POLICY "notif_own_update" ON public.notifications FOR UPDATE
    USING (user_id = (SELECT auth.uid()))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'notifications user policies skip: %', SQLERRM; END; $$;
-- announcements
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements';
  EXECUTE 'DROP POLICY IF EXISTS "Users read active announcements" ON public.announcements';
  EXECUTE 'DROP POLICY IF EXISTS "ann_admin_all" ON public.announcements';
  EXECUTE 'DROP POLICY IF EXISTS "ann_public_select" ON public.announcements';
  EXECUTE $q$
    CREATE POLICY "ann_admin_all" ON public.announcements FOR ALL
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ann_public_select" ON public.announcements FOR SELECT
    USING (is_active = true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'announcements skip: %', SQLERRM; END; $$;
-- notification_log (admin select)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins see notification log" ON public.notification_log';
  EXECUTE 'DROP POLICY IF EXISTS "nl_admin_select" ON public.notification_log';
  EXECUTE $q$
    CREATE POLICY "nl_admin_select" ON public.notification_log FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'notification_log admin select skip: %', SQLERRM; END; $$;
-- anomaly_logs
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins see anomaly logs" ON public.anomaly_logs';
  EXECUTE 'DROP POLICY IF EXISTS "al_admin_select" ON public.anomaly_logs';
  EXECUTE $q$
    CREATE POLICY "al_admin_select" ON public.anomaly_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'anomaly_logs skip: %', SQLERRM; END; $$;
-- follower_history
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated workspace members can read follower history" ON public.follower_history';
  EXECUTE 'DROP POLICY IF EXISTS "fh_workspace_select" ON public.follower_history';
  EXECUTE 'DROP POLICY IF EXISTS "fh_service_write" ON public.follower_history';
  EXECUTE $q$
    CREATE POLICY "fh_workspace_select" ON public.follower_history FOR SELECT
    USING ((SELECT auth.uid()) IS NOT NULL)
  $q$;
  EXECUTE $q$
    CREATE POLICY "fh_service_write" ON public.follower_history FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'follower_history skip: %', SQLERRM; END; $$;
-- workspaces (existing policies — ensure (SELECT auth.uid()))
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "ws_select" ON public.workspaces';
  EXECUTE 'DROP POLICY IF EXISTS "ws_insert" ON public.workspaces';
  EXECUTE 'DROP POLICY IF EXISTS "ws_update" ON public.workspaces';
  EXECUTE 'DROP POLICY IF EXISTS "ws_delete" ON public.workspaces';
  EXECUTE $q$
    CREATE POLICY "ws_select" ON public.workspaces FOR SELECT
    USING (id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ws_insert" ON public.workspaces FOR INSERT
    WITH CHECK (owner_id = (SELECT auth.uid()))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ws_update" ON public.workspaces FOR UPDATE
    USING (owner_id = (SELECT auth.uid()))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ws_delete" ON public.workspaces FOR DELETE
    USING (owner_id = (SELECT auth.uid()))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'workspaces skip: %', SQLERRM; END; $$;
-- workspace_members (consolidated)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "wm_select" ON public.workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS "wm_service_write" ON public.workspace_members';
  EXECUTE $q$
    CREATE POLICY "wm_select" ON public.workspace_members FOR SELECT
    USING (user_id = (SELECT auth.uid()) OR workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
    ))
  $q$;
  EXECUTE $q$
    CREATE POLICY "wm_service_write" ON public.workspace_members FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'workspace_members skip: %', SQLERRM; END; $$;
-- enrichment_jobs
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users see own workspace jobs" ON public.enrichment_jobs';
  EXECUTE 'DROP POLICY IF EXISTS "ej_member_select" ON public.enrichment_jobs';
  EXECUTE 'DROP POLICY IF EXISTS "ej_owner_select" ON public.enrichment_jobs';
  EXECUTE 'DROP POLICY IF EXISTS "ej_service_write" ON public.enrichment_jobs';
  EXECUTE $q$
    CREATE POLICY "ej_member_select" ON public.enrichment_jobs FOR SELECT
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ej_service_write" ON public.enrichment_jobs FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'enrichment_jobs skip: %', SQLERRM; END; $$;
-- idempotency_keys
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users see own idempotency keys" ON public.idempotency_keys';
  EXECUTE 'DROP POLICY IF EXISTS "ik_self_select" ON public.idempotency_keys';
  EXECUTE $q$
    CREATE POLICY "ik_self_select" ON public.idempotency_keys FOR SELECT
    USING (user_id = (SELECT auth.uid()))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'idempotency_keys skip: %', SQLERRM; END; $$;
-- pipeline_stages
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage pipeline stages" ON public.pipeline_stages';
  EXECUTE 'DROP POLICY IF EXISTS "ps_member_all" ON public.pipeline_stages';
  EXECUTE $q$
    CREATE POLICY "ps_member_all" ON public.pipeline_stages FOR ALL
    USING (campaign_id IN (
      SELECT id FROM public.campaigns WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
      )
    ))
    WITH CHECK (campaign_id IN (
      SELECT id FROM public.campaigns WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())
      )
    ))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pipeline_stages skip: %', SQLERRM; END; $$;
-- security_alerts
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "security_alerts_read_admin" ON public.security_alerts';
  EXECUTE 'DROP POLICY IF EXISTS "security_alerts_insert_service" ON public.security_alerts';
  EXECUTE 'DROP POLICY IF EXISTS "security_alerts_update_service" ON public.security_alerts';
  EXECUTE 'DROP POLICY IF EXISTS "sa_admin_select" ON public.security_alerts';
  EXECUTE 'DROP POLICY IF EXISTS "sa_service_write" ON public.security_alerts';
  EXECUTE $q$
    CREATE POLICY "sa_admin_select" ON public.security_alerts FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
  EXECUTE $q$
    CREATE POLICY "sa_service_write" ON public.security_alerts FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'security_alerts skip: %', SQLERRM; END; $$;
-- api_rate_limits
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "api_rate_limits_service_rw" ON public.api_rate_limits';
  EXECUTE $q$
    CREATE POLICY "api_rate_limits_service_rw" ON public.api_rate_limits FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'api_rate_limits skip: %', SQLERRM; END; $$;
-- security_events
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "se_admin_select" ON public.security_events';
  EXECUTE 'DROP POLICY IF EXISTS "se_service_write" ON public.security_events';
  EXECUTE 'DROP POLICY IF EXISTS "security_events_select_admin" ON public.security_events';
  EXECUTE 'DROP POLICY IF EXISTS "security_events_insert_service_role" ON public.security_events';
  EXECUTE 'DROP POLICY IF EXISTS "security_events_insert_service" ON public.security_events';
  EXECUTE $q$
    CREATE POLICY "se_admin_select" ON public.security_events FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
  EXECUTE $q$
    CREATE POLICY "se_service_write" ON public.security_events FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'security_events skip: %', SQLERRM; END; $$;
-- tracking_events
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "te_owner_select" ON public.tracking_events';
  EXECUTE 'DROP POLICY IF EXISTS "te_service_insert" ON public.tracking_events';
  EXECUTE $q$
    CREATE POLICY "te_owner_select" ON public.tracking_events FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tracking_links tl JOIN public.workspace_members wm ON wm.workspace_id = tl.workspace_id WHERE tl.id = tracking_events.link_id AND wm.user_id = (SELECT auth.uid())))
  $q$;
  EXECUTE $q$
    CREATE POLICY "te_service_insert" ON public.tracking_events FOR INSERT TO service_role
    WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'tracking_events skip: %', SQLERRM; END; $$;
-- influencers_cache
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "ic_auth_select" ON public.influencers_cache';
  EXECUTE 'DROP POLICY IF EXISTS "ic_service_write" ON public.influencers_cache';
  EXECUTE $q$
    CREATE POLICY "ic_auth_select" ON public.influencers_cache FOR SELECT
    USING ((SELECT auth.uid()) IS NOT NULL)
  $q$;
  EXECUTE $q$
    CREATE POLICY "ic_service_write" ON public.influencers_cache FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'influencers_cache skip: %', SQLERRM; END; $$;
-- system_constants
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "sc_service_only" ON public.system_constants';
  EXECUTE $q$
    CREATE POLICY "sc_service_only" ON public.system_constants FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'system_constants skip: %', SQLERRM; END; $$;
-- blocked_email_domains
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "bed_service_only" ON public.blocked_email_domains';
  EXECUTE $q$
    CREATE POLICY "bed_service_only" ON public.blocked_email_domains FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'blocked_email_domains skip: %', SQLERRM; END; $$;
-- audience_analysis
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "aa_workspace_select" ON public.audience_analysis';
  EXECUTE 'DROP POLICY IF EXISTS "aa_service_write" ON public.audience_analysis';
  EXECUTE $q$
    CREATE POLICY "aa_workspace_select" ON public.audience_analysis FOR SELECT
    USING ((SELECT auth.uid()) IS NOT NULL)
  $q$;
  EXECUTE $q$
    CREATE POLICY "aa_service_write" ON public.audience_analysis FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'audience_analysis skip: %', SQLERRM; END; $$;
-- linked_accounts
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "la_workspace_select" ON public.linked_accounts';
  EXECUTE 'DROP POLICY IF EXISTS "la_service_write" ON public.linked_accounts';
  EXECUTE $q$
    CREATE POLICY "la_workspace_select" ON public.linked_accounts FOR SELECT
    USING ((SELECT auth.uid()) IS NOT NULL)
  $q$;
  EXECUTE $q$
    CREATE POLICY "la_service_write" ON public.linked_accounts FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'linked_accounts skip: %', SQLERRM; END; $$;
-- system_metrics
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "system_metrics_select_admin" ON public.system_metrics';
  EXECUTE 'DROP POLICY IF EXISTS "telemetry_insert_service_role_system_metrics" ON public.system_metrics';
  EXECUTE 'DROP POLICY IF EXISTS "sm_admin_select" ON public.system_metrics';
  EXECUTE 'DROP POLICY IF EXISTS "sm_service_write" ON public.system_metrics';
  EXECUTE $q$
    CREATE POLICY "sm_admin_select" ON public.system_metrics FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
  EXECUTE $q$
    CREATE POLICY "sm_service_write" ON public.system_metrics FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'system_metrics skip: %', SQLERRM; END; $$;
-- api_usage_metrics
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "api_usage_metrics_select_admin" ON public.api_usage_metrics';
  EXECUTE 'DROP POLICY IF EXISTS "telemetry_insert_service_role_api_usage" ON public.api_usage_metrics';
  EXECUTE 'DROP POLICY IF EXISTS "aum_admin_select" ON public.api_usage_metrics';
  EXECUTE 'DROP POLICY IF EXISTS "aum_service_write" ON public.api_usage_metrics';
  EXECUTE $q$
    CREATE POLICY "aum_admin_select" ON public.api_usage_metrics FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
  EXECUTE $q$
    CREATE POLICY "aum_service_write" ON public.api_usage_metrics FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'api_usage_metrics skip: %', SQLERRM; END; $$;
-- credit_consumption_metrics
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "credit_consumption_metrics_select_admin" ON public.credit_consumption_metrics';
  EXECUTE 'DROP POLICY IF EXISTS "telemetry_insert_service_role_credit_metrics" ON public.credit_consumption_metrics';
  EXECUTE 'DROP POLICY IF EXISTS "ccm_admin_select" ON public.credit_consumption_metrics';
  EXECUTE 'DROP POLICY IF EXISTS "ccm_service_write" ON public.credit_consumption_metrics';
  EXECUTE $q$
    CREATE POLICY "ccm_admin_select" ON public.credit_consumption_metrics FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
  EXECUTE $q$
    CREATE POLICY "ccm_service_write" ON public.credit_consumption_metrics FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'credit_consumption_metrics skip: %', SQLERRM; END; $$;
-- discovery_runs
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "discovery_runs_admin_read" ON public.discovery_runs';
  EXECUTE 'DROP POLICY IF EXISTS "dr_admin_select" ON public.discovery_runs';
  EXECUTE $q$
    CREATE POLICY "dr_admin_select" ON public.discovery_runs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','super_admin')))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'discovery_runs skip: %', SQLERRM; END; $$;
-- profiles (catch-all — drop any leftover old-name policy)
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'profiles old policy cleanup skip: %', SQLERRM; END; $$;
-- ─────────────────────────────────────────────────────────────
-- PART 6: Additional performance indexes
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_linter_user_roles_user_id
  ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_linter_user_roles_role
  ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_linter_campaigns_id
  ON public.campaigns(id);
CREATE INDEX IF NOT EXISTS idx_linter_support_tickets_user_id
  ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_linter_enrichment_jobs_workspace_id
  ON public.enrichment_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linter_notifications_user_id
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_linter_follower_history_inflid
  ON public.follower_history(profile_id);
-- ─────────────────────────────────────────────────────────────
-- NOTE: auth_leaked_password_protection — must be enabled via
-- Supabase Dashboard → Authentication → Password Protection.
-- Cannot be set via SQL migration.
--
-- NOTE: extension_in_public (vector, pg_net, pg_trgm, unaccent)
-- Moving extensions out of public requires dropping and recreating
-- dependent functions. Not safe to automate; do via Dashboard:
-- Settings → Database → Extensions → move to 'extensions' schema.
-- ─────────────────────────────────────────────────────────────;
