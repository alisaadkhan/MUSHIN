-- ============================================================
-- Migration: Fix Credit System
-- Issues: Credits not deducting, insufficient permissions
-- ============================================================

-- 1. Ensure consume_search_credit function is working correctly
CREATE OR REPLACE FUNCTION public.consume_search_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  -- Allow both service_role AND authenticated users (for direct client calls)
  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
    END IF;

    -- Verify user is member of this workspace
    IF NOT EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = ws_id
        AND wm.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'workspace_access_denied' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Lock the row and get current balance
  SELECT search_credits_remaining
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

  -- Deduct credit
  UPDATE workspaces
  SET    search_credits_remaining = v_remaining - 1
  WHERE  id = ws_id;
  
  -- Log the usage
  INSERT INTO public.credits_usage (workspace_id, action_type, amount, details)
  VALUES (ws_id, 'search', 1, jsonb_build_object('timestamp', now()));
END;
$$;

-- 2. Ensure consume_ai_credit function is working correctly
CREATE OR REPLACE FUNCTION public.consume_ai_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = ws_id
        AND wm.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'workspace_access_denied' USING ERRCODE = 'P0001';
    END IF;
  END IF;

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
  
  INSERT INTO public.credits_usage (workspace_id, action_type, amount, details)
  VALUES (ws_id, 'ai_search', 1, jsonb_build_object('timestamp', now()));
END;
$$;

-- 3. Ensure consume_enrichment_credit function is working correctly
CREATE OR REPLACE FUNCTION public.consume_enrichment_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int;
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.workspace_members wm
      WHERE wm.workspace_id = ws_id
        AND wm.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'workspace_access_denied' USING ERRCODE = 'P0001';
    END IF;
  END IF;

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
  
  INSERT INTO public.credits_usage (workspace_id, action_type, amount, details)
  VALUES (ws_id, 'enrichment', 1, jsonb_build_object('timestamp', now()));
END;
$$;

-- 4. Grant execute permissions correctly
-- Revoke from everyone first
REVOKE EXECUTE ON FUNCTION public.consume_search_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_search_credit(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_search_credit(uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.consume_ai_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credit(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credit(uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.consume_enrichment_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_enrichment_credit(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_enrichment_credit(uuid) FROM anon;

-- Grant to service_role (for edge functions)
GRANT EXECUTE ON FUNCTION public.consume_search_credit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_enrichment_credit(uuid) TO service_role;

-- 5. Add helper function to get workspace credits (for frontend display)
CREATE OR REPLACE FUNCTION public.get_workspace_credits()
RETURNS TABLE (
  search_credits int,
  ai_credits int,
  enrichment_credits int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws_id uuid;
BEGIN
  -- Get user's workspace
  SELECT workspace_id INTO v_ws_id
  FROM public.workspace_members
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  IF v_ws_id IS NULL THEN
    RAISE EXCEPTION 'no_workspace_found';
  END IF;
  
  RETURN QUERY
  SELECT 
    w.search_credits_remaining,
    w.ai_credits_remaining,
    w.enrichment_credits_remaining
  FROM public.workspaces w
  WHERE w.id = v_ws_id;
END;
$$;

-- Grant execute to authenticated users
REVOKE EXECUTE ON FUNCTION public.get_workspace_credits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workspace_credits() TO authenticated;

-- 6. Fix credits_usage RLS policy (already in previous migration, but ensure it's correct)
DROP POLICY IF EXISTS "Workspace members can view credits" ON public.credits_usage;
CREATE POLICY "Workspace members can view credits" ON public.credits_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm 
      WHERE wm.workspace_id = credits_usage.workspace_id 
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can insert credits" ON public.credits_usage;
CREATE POLICY "Service role can insert credits" ON public.credits_usage
  FOR INSERT
  WITH CHECK (true); -- Service role handles authorization

-- 7. Add index for better performance
CREATE INDEX IF NOT EXISTS idx_credits_usage_workspace_created 
  ON public.credits_usage(workspace_id, created_at DESC);

-- ============================================================
-- Verification Queries
-- ============================================================
-- Run these to verify the fix:

-- Check functions exist:
-- SELECT proname, prosecdef FROM pg_proc 
-- WHERE proname IN ('consume_search_credit', 'consume_ai_credit', 'consume_enrichment_credit', 'get_workspace_credits');

-- Check permissions:
-- SELECT grantee, privilege_type 
-- FROM information_schema.routine_privileges 
-- WHERE routine_name IN ('consume_search_credit', 'consume_ai_credit', 'consume_enrichment_credit', 'get_workspace_credits');

-- Test credit deduction (replace WITH_YOUR_WORKSPACE_ID):
-- SELECT * FROM public.get_workspace_credits();
