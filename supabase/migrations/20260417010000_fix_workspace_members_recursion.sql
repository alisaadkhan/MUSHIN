-- Fix infinite recursion on workspace_members introduced in v2 remediation
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "wm_select" ON public.workspace_members';
  EXECUTE $q$
    CREATE POLICY "wm_select" ON public.workspace_members FOR SELECT
    USING (user_id = (SELECT auth.uid()))
  $q$;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'workspace_members skip: %', SQLERRM; END; $$;
