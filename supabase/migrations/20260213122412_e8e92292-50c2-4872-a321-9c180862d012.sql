CREATE OR REPLACE FUNCTION get_user_workspace()
RETURNS TABLE (workspace_id UUID, role TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT workspace_id, role::TEXT FROM workspace_members WHERE user_id = auth.uid() LIMIT 1;
$$;