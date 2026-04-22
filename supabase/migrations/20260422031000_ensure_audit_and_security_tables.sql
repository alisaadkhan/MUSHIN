-- Ensure core admin visibility tables exist (idempotent)
-- This prevents "empty audit/security" pages caused by missing earlier migrations.

-- 1) System audit logs + append rpc
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  action_description text NOT NULL,
  ip_address text,
  user_agent text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_hash text,
  log_hash text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_ts ON public.system_audit_logs("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_actor ON public.system_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_target ON public.system_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_workspace ON public.system_audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_action_type ON public.system_audit_logs(action_type);
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;
-- The project already defines public.is_system_admin(uuid). If missing, this policy will still be created but may error only on brand-new DBs.
DROP POLICY IF EXISTS system_audit_logs_select_system_admin ON public.system_audit_logs;
CREATE POLICY system_audit_logs_select_system_admin ON public.system_audit_logs
  FOR SELECT USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS system_audit_logs_insert_service_role ON public.system_audit_logs;
CREATE POLICY system_audit_logs_insert_service_role ON public.system_audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
REVOKE UPDATE, DELETE ON public.system_audit_logs FROM anon, authenticated;
-- Hash chain is optional; if pgcrypto/digest isn't available, we still allow inserts with empty hash.
CREATE OR REPLACE FUNCTION public.append_system_audit_log(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_workspace_id uuid,
  p_action_type text,
  p_action_description text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_metadata_json jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_prev_hash text;
  v_new_hash text;
BEGIN
  SELECT sal.log_hash
  INTO v_prev_hash
  FROM public.system_audit_logs sal
  ORDER BY sal."timestamp" DESC, sal.id DESC
  LIMIT 1;

  BEGIN
    v_new_hash := encode(
      extensions.digest(
        convert_to(
          coalesce(v_prev_hash, '') || '|' ||
          coalesce(p_actor_user_id::text, '') || '|' ||
          coalesce(p_target_user_id::text, '') || '|' ||
          coalesce(p_workspace_id::text, '') || '|' ||
          coalesce(p_action_type, '') || '|' ||
          coalesce(p_action_description, '') || '|' ||
          coalesce(p_ip_address, '') || '|' ||
          coalesce(p_user_agent, '') || '|' ||
          coalesce(p_metadata_json::text, '') || '|' ||
          extract(epoch from now())::text,
          'utf8'
        ),
        'sha256'::text
      ),
      'hex'
    );
  EXCEPTION WHEN OTHERS THEN
    v_new_hash := '';
  END;

  INSERT INTO public.system_audit_logs (
    actor_user_id,
    target_user_id,
    workspace_id,
    action_type,
    action_description,
    ip_address,
    user_agent,
    metadata_json,
    prev_hash,
    log_hash
  ) VALUES (
    p_actor_user_id,
    p_target_user_id,
    p_workspace_id,
    p_action_type,
    p_action_description,
    p_ip_address,
    p_user_agent,
    coalesce(p_metadata_json, '{}'::jsonb),
    v_prev_hash,
    coalesce(v_new_hash, '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.append_system_audit_log(uuid, uuid, uuid, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.append_system_audit_log(uuid, uuid, uuid, text, text, text, text, jsonb) TO service_role;
-- 2) Security alerts
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'low',
  category text NOT NULL DEFAULT 'unknown',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS severity text;
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.security_alerts
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
-- Support/admin/system-admin can read
DROP POLICY IF EXISTS security_alerts_select_support_admin ON public.security_alerts;
CREATE POLICY security_alerts_select_support_admin ON public.security_alerts
  FOR SELECT
  USING (public.is_support_or_admin() OR public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS security_alerts_insert_service_role ON public.security_alerts;
CREATE POLICY security_alerts_insert_service_role ON public.security_alerts
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
REVOKE UPDATE, DELETE ON public.security_alerts FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON public.security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_workspace ON public.security_alerts(workspace_id);
