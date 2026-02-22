
-- Fix workspace_secrets: owners can write but NOT read (keys stay server-side only)
DROP POLICY IF EXISTS "Owners can manage secrets" ON public.workspace_secrets;

-- Owners can insert their secrets
CREATE POLICY "Owners can insert secrets" ON public.workspace_secrets
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_owner(workspace_id));

-- Owners can update their secrets  
CREATE POLICY "Owners can update secrets" ON public.workspace_secrets
  FOR UPDATE TO authenticated
  USING (is_workspace_owner(workspace_id));

-- Owners can check if a row exists (but hubspot_api_key column won't matter - they just need to know it's configured)
-- We'll use a security definer function to check status without exposing the key
CREATE OR REPLACE FUNCTION public.get_hubspot_configured(_workspace_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_secrets
    WHERE workspace_id = _workspace_id
    AND hubspot_api_key IS NOT NULL
    AND hubspot_api_key != ''
  );
$$;
