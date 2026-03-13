-- Credit RPC Hardening
-- Enforces service-role-only execution and defense-in-depth auth checks
-- to prevent cross-workspace credit manipulation.

-- consume_search_credit
CREATE OR REPLACE FUNCTION public.consume_search_credit(ws_id uuid)
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

  UPDATE workspaces
  SET    search_credits_remaining = v_remaining - 1
  WHERE  id = ws_id;
END;
$$;
-- consume_ai_credit
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
END;
$$;
-- consume_enrichment_credit
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
END;
$$;
-- consume_email_credit
CREATE OR REPLACE FUNCTION public.consume_email_credit(ws_id uuid)
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

  SELECT email_sends_remaining
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
  SET    email_sends_remaining = v_remaining - 1
  WHERE  id = ws_id;
END;
$$;
-- Lock down execution grants: service_role only
REVOKE EXECUTE ON FUNCTION public.consume_search_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_search_credit(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_search_credit(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.consume_search_credit(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credit(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_ai_credit(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.consume_ai_credit(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.consume_enrichment_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_enrichment_credit(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_enrichment_credit(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.consume_enrichment_credit(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.consume_email_credit(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_email_credit(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_email_credit(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.consume_email_credit(uuid) TO service_role;
