-- MUSHIN — Fix workspace_members RLS recursion (final)
-- Some historical migrations recreated a self-referential wm_select policy.
-- This replaces it with a non-recursive policy.

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "wm_select" ON public.workspace_members';
  EXECUTE $q$
    CREATE POLICY "wm_select" ON public.workspace_members FOR SELECT
    TO public
    USING (user_id = (SELECT auth.uid()))
  $q$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'workspace_members wm_select fix skipped: %', SQLERRM;
END; $$;

