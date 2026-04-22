-- ============================================================
-- Migration: Fix RLS Policies for History, Saved Searches, Campaigns
-- Issue: Missing INSERT/UPDATE/DELETE policies blocking operations
-- ============================================================

-- 1. search_history - Add INSERT policy for logging searches
-- Current: Only has SELECT policy
DROP POLICY IF EXISTS "Workspace members can insert history" ON public.search_history;
CREATE POLICY "Workspace members can insert history" ON public.search_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm 
      WHERE wm.workspace_id = search_history.workspace_id 
      AND wm.user_id = auth.uid()
    )
  );
-- Also allow DELETE for cleanup if needed
DROP POLICY IF EXISTS "Workspace members can delete history" ON public.search_history;
CREATE POLICY "Workspace members can delete history" ON public.search_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm 
      WHERE wm.workspace_id = search_history.workspace_id 
      AND wm.user_id = auth.uid()
    )
  );
-- 2. saved_searches - Ensure policy covers ALL operations (SELECT, INSERT, UPDATE, DELETE)
-- Current: Policy without FOR ALL may not cover all operations in some Supabase versions
DROP POLICY IF EXISTS "Workspace members can manage saved searches" ON public.saved_searches;
CREATE POLICY "Workspace members can manage saved searches" ON public.saved_searches
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm 
      WHERE wm.workspace_id = saved_searches.workspace_id 
      AND wm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm 
      WHERE wm.workspace_id = saved_searches.workspace_id 
      AND wm.user_id = auth.uid()
    )
  );
-- 3. campaigns - Ensure policy covers ALL operations
-- Current: Only has USING clause, may not cover INSERT/UPDATE properly
DROP POLICY IF EXISTS "Workspace members can manage campaigns" ON public.campaigns;
CREATE POLICY "Workspace members can manage campaigns" ON public.campaigns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm 
      WHERE wm.workspace_id = campaigns.workspace_id 
      AND wm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm 
      WHERE wm.workspace_id = campaigns.workspace_id 
      AND wm.user_id = auth.uid()
    )
  );
-- 4. campaign_activity - Add INSERT policy for logging campaign events
DROP POLICY IF EXISTS "Workspace members can insert activity" ON public.campaign_activity;
CREATE POLICY "Workspace members can insert activity" ON public.campaign_activity
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_activity.campaign_id AND wm.user_id = auth.uid()
    )
  );
-- 5. credits_usage - Add INSERT policy for tracking credit consumption
DROP POLICY IF EXISTS "Workspace members can insert credit usage" ON public.credits_usage;
CREATE POLICY "Workspace members can insert credit usage" ON public.credits_usage
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm 
      WHERE wm.workspace_id = credits_usage.workspace_id 
      AND wm.user_id = auth.uid()
    )
  );
-- 6. influencer_profiles - Ensure INSERT/UPDATE policies exist for enrichment
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.influencer_profiles;
CREATE POLICY "Service role can insert profiles" ON public.influencer_profiles
  FOR INSERT
  WITH CHECK (true);
-- Allow inserts (edge functions handle authorization)

DROP POLICY IF EXISTS "Service role can update profiles" ON public.influencer_profiles;
CREATE POLICY "Service role can update profiles" ON public.influencer_profiles
  FOR UPDATE
  USING (true);
-- Allow updates (edge functions handle authorization)

-- 7. influencers_cache - Allow upserts from edge functions
DROP POLICY IF EXISTS "Service role can manage cache" ON public.influencers_cache;
CREATE POLICY "Service role can manage cache" ON public.influencers_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);
-- 8. influencer_evaluations - Allow inserts from edge functions
DROP POLICY IF EXISTS "Service role can insert evaluations" ON public.influencer_evaluations;
CREATE POLICY "Service role can insert evaluations" ON public.influencer_evaluations
  FOR INSERT
  WITH CHECK (true);
-- ============================================================
-- Verification queries (run these in Supabase SQL Editor to confirm)
-- ============================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies 
-- WHERE tablename IN ('search_history', 'saved_searches', 'campaigns', 'campaign_activity', 'credits_usage')
-- ORDER BY tablename, policyname;;
