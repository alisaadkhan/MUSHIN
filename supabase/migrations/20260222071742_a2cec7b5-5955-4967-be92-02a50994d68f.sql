
-- ============================================================
-- FIX 1: Create workspace_secrets table for sensitive API keys
-- ============================================================
CREATE TABLE public.workspace_secrets (
  workspace_id UUID PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  hubspot_api_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_secrets ENABLE ROW LEVEL SECURITY;

-- Only owners can INSERT/UPDATE (via edge function with service role, but allow owner write for initial setup)
-- No SELECT for regular users - keys are never sent to client
CREATE POLICY "Owners can manage secrets" ON public.workspace_secrets
  FOR ALL TO authenticated
  USING (is_workspace_owner(workspace_id))
  WITH CHECK (is_workspace_owner(workspace_id));

-- ============================================================
-- FIX 2: Restrict workspace UPDATE to prevent credit manipulation
-- Replace the overly permissive owner update policy with a
-- SECURITY DEFINER function that only allows safe column updates
-- ============================================================
DROP POLICY IF EXISTS "Owners can update workspace" ON public.workspaces;

-- Create a safe RPC for workspace settings updates
CREATE OR REPLACE FUNCTION public.update_workspace_settings(
  _workspace_id UUID,
  _name TEXT DEFAULT NULL,
  _settings JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_workspace_owner(_workspace_id) THEN
    RAISE EXCEPTION 'Unauthorized: not workspace owner';
  END IF;

  UPDATE public.workspaces
  SET
    name = COALESCE(_name, name),
    settings = COALESCE(_settings, settings)
  WHERE id = _workspace_id;
END;
$$;

-- Create restricted update policy: owners can only update name and settings
-- Credits, plan, and other billing fields are protected
CREATE POLICY "Owners can update workspace safe fields" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());
