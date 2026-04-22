-- ============================================================
-- Migration: 20260416_linter_remediation.sql  (v3 - final)
-- Purpose  : Resolve Supabase linter warnings idempotently
--   1. auth_rls_initplan → wrap auth.uid() in (SELECT ...) 
--      for plan-time constant evaluation.
--   2. security_definer_view → security_invoker on views.
--   3. Performance indexes for RLS subquery paths.
--
-- Strategy: Only touch known-existing policies using IF EXISTS.
--   All CREATE POLICY statements first DROP IF EXISTS the same
--   name so re-runs are safe.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Part 1: profiles — fix auth_rls_initplan
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Drop and recreate all profile policies with (SELECT auth.uid())
  EXECUTE 'DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles';

  EXECUTE $q$
    CREATE POLICY "profiles_select_own" ON public.profiles
      FOR SELECT USING (id = (SELECT auth.uid()))
  $q$;
  EXECUTE $q$
    CREATE POLICY "profiles_update_own" ON public.profiles
      FOR UPDATE USING (id = (SELECT auth.uid()))
  $q$;
  EXECUTE $q$
    CREATE POLICY "profiles_insert_own" ON public.profiles
      FOR INSERT WITH CHECK (id = (SELECT auth.uid()))
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'profiles policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 1b: workspace_members — fix auth_rls_initplan
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "wm_select_own" ON public.workspace_members';
  EXECUTE 'DROP POLICY IF EXISTS "Members can view their own membership" ON public.workspace_members';

  EXECUTE $q$
    CREATE POLICY "wm_select_own" ON public.workspace_members
      FOR SELECT USING (user_id = (SELECT auth.uid()))
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'workspace_members policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 1c: workspaces — fix auth_rls_initplan
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "ws_member_select" ON public.workspaces';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view workspace" ON public.workspaces';

  EXECUTE $q$
    CREATE POLICY "ws_member_select" ON public.workspaces
      FOR SELECT USING (
        id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'workspaces policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 1d: search_history — fix auth_rls_initplan
-- (Table uses workspace_id not user_id)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view history" ON public.search_history';
  EXECUTE 'DROP POLICY IF EXISTS "sh_member_select" ON public.search_history';
  EXECUTE 'DROP POLICY IF EXISTS "sh_member_insert" ON public.search_history';

  EXECUTE $q$
    CREATE POLICY "sh_member_select" ON public.search_history
      FOR SELECT USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
  $q$;
  EXECUTE $q$
    CREATE POLICY "sh_member_insert" ON public.search_history
      FOR INSERT WITH CHECK (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'search_history policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 1e: campaigns — fix auth_rls_initplan
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view campaigns" ON public.campaigns';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can insert campaigns" ON public.campaigns';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can update campaigns" ON public.campaigns';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can delete campaigns" ON public.campaigns';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage campaigns" ON public.campaigns';
  EXECUTE 'DROP POLICY IF EXISTS "camp_member_all" ON public.campaigns';

  EXECUTE $q$
    CREATE POLICY "camp_member_all" ON public.campaigns
      FOR ALL USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      ) WITH CHECK (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'campaigns policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 1f: pipeline_cards — fix auth_rls_initplan
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage pipeline cards" ON public.pipeline_cards';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage pipeline_cards" ON public.pipeline_cards';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view pipeline_cards" ON public.pipeline_cards';
  EXECUTE 'DROP POLICY IF EXISTS "pc_member_all" ON public.pipeline_cards';

  EXECUTE $q$
    CREATE POLICY "pc_member_all" ON public.pipeline_cards
      FOR ALL USING (
        campaign_id IN (
          SELECT id FROM public.campaigns WHERE workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = (SELECT auth.uid())
          )
        )
      )
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pipeline_cards policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 1g: campaign_activity — fix auth_rls_initplan
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view activity" ON public.campaign_activity';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view campaign_activity" ON public.campaign_activity';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can insert campaign_activity" ON public.campaign_activity';
  EXECUTE 'DROP POLICY IF EXISTS "ca_member_all" ON public.campaign_activity';

  EXECUTE $q$
    CREATE POLICY "ca_member_all" ON public.campaign_activity
      FOR ALL USING (
        campaign_id IN (
          SELECT id FROM public.campaigns WHERE workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = (SELECT auth.uid())
          )
        )
      )
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'campaign_activity policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 1h: influencer_lists — fix auth_rls_initplan
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage lists" ON public.influencer_lists';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view influencer_lists" ON public.influencer_lists';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage influencer_lists" ON public.influencer_lists';
  EXECUTE 'DROP POLICY IF EXISTS "il_member_all" ON public.influencer_lists';

  EXECUTE $q$
    CREATE POLICY "il_member_all" ON public.influencer_lists
      FOR ALL USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'influencer_lists policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 1i: list_items — fix auth_rls_initplan
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view list_items" ON public.list_items';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage list_items" ON public.list_items';
  EXECUTE 'DROP POLICY IF EXISTS "li_member_all" ON public.list_items';

  EXECUTE $q$
    CREATE POLICY "li_member_all" ON public.list_items
      FOR ALL USING (
        list_id IN (
          SELECT id FROM public.influencer_lists WHERE workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = (SELECT auth.uid())
          )
        )
      )
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'list_items policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 1j: saved_searches — fix auth_rls_initplan
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage saved searches" ON public.saved_searches';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view saved_searches" ON public.saved_searches';
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can manage saved_searches" ON public.saved_searches';
  EXECUTE 'DROP POLICY IF EXISTS "ss_member_all" ON public.saved_searches';

  EXECUTE $q$
    CREATE POLICY "ss_member_all" ON public.saved_searches
      FOR ALL USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'saved_searches policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 1k: credits_usage — fix auth_rls_initplan
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Workspace members can view credits" ON public.credits_usage';
  EXECUTE 'DROP POLICY IF EXISTS "cu_member_select" ON public.credits_usage';

  EXECUTE $q$
    CREATE POLICY "cu_member_select" ON public.credits_usage
      FOR SELECT USING (
        workspace_id IN (
          SELECT workspace_id FROM public.workspace_members
          WHERE user_id = (SELECT auth.uid())
        )
      )
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'credits_usage policy fix skipped: %', SQLERRM;
END; $$;
-- ─────────────────────────────────────────────────────────────
-- Part 2: Fix security_definer_view for any existing views
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER VIEW public.%I SET (security_invoker = true)',
        v.table_name
      );
      RAISE NOTICE 'Set security_invoker on view: %', v.table_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not alter view % : %', v.table_name, SQLERRM;
    END;
  END LOOP;
END;
$$;
-- ─────────────────────────────────────────────────────────────
-- Part 3: Performance indexes for RLS subquery resolution
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_linter_wm_user_id
  ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_linter_wm_workspace_id
  ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linter_campaigns_workspace_id
  ON public.campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linter_pipeline_campaign_id
  ON public.pipeline_cards(campaign_id);
CREATE INDEX IF NOT EXISTS idx_linter_list_items_list_id
  ON public.list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_linter_il_workspace_id
  ON public.influencer_lists(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linter_ca_campaign_id
  ON public.campaign_activity(campaign_id);
CREATE INDEX IF NOT EXISTS idx_linter_sh_workspace_id
  ON public.search_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linter_ss_workspace_id
  ON public.saved_searches(workspace_id);
