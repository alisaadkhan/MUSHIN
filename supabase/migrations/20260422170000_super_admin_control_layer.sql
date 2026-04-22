-- ============================================================================
-- Super Admin Control Layer (RBAC + system config + governance primitives)
-- Migration: 20260422170000_super_admin_control_layer.sql
--
-- Additive-only. Integrates with existing `public.user_roles` (app_role) where
-- `super_admin` is the ultimate authority, but adds *granular* permissions.
--
-- Zero-trust constraints:
-- - Never trust the client for permission decisions.
-- - Use SECURITY DEFINER + explicit allowlists + RLS.
-- - All privileged actions must be auditable (audit_logs + system_audit_logs already exist).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) RBAC governance tables (feature-level permissions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL UNIQUE, -- e.g. 'user.read', 'billing.write'
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_reason text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_reason text,
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON public.user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_active ON public.user_role_assignments(user_id) WHERE revoked_at IS NULL;

-- RLS: super_admin owns governance. No frontend should read/write these directly.
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_super_admin_all ON public.roles;
CREATE POLICY roles_super_admin_all ON public.roles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS permissions_super_admin_all ON public.permissions;
CREATE POLICY permissions_super_admin_all ON public.permissions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS role_permissions_super_admin_all ON public.role_permissions;
CREATE POLICY role_permissions_super_admin_all ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS user_role_assignments_super_admin_all ON public.user_role_assignments;
CREATE POLICY user_role_assignments_super_admin_all ON public.user_role_assignments
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

REVOKE UPDATE, DELETE ON public.roles, public.permissions, public.role_permissions, public.user_role_assignments FROM anon;
REVOKE ALL ON public.roles, public.permissions, public.role_permissions, public.user_role_assignments FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- 2) Permission check helper (super_admin bypass + explicit grants)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Ultimate authority: super_admin always true.
    public.is_super_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      JOIN public.permissions perm ON perm.id = rp.permission_id
      WHERE ura.user_id = p_user_id
        AND ura.revoked_at IS NULL
        AND perm.action = p_action
    );
$$;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3) System configuration layer (non-secret settings + API keys)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_sensitive boolean NOT NULL DEFAULT false, -- if true, value must be redacted from any RPC
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_settings_super_admin_all ON public.system_settings;
CREATE POLICY system_settings_super_admin_all ON public.system_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
REVOKE ALL ON public.system_settings FROM PUBLIC;

-- API key registry: stores only hashes; plaintext only ever returned from SECURITY DEFINER once.
CREATE TABLE IF NOT EXISTS public.system_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  key_hash text NOT NULL, -- sha256 hex
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_reason text
);

CREATE INDEX IF NOT EXISTS idx_system_api_keys_active ON public.system_api_keys(revoked_at) WHERE revoked_at IS NULL;

ALTER TABLE public.system_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_api_keys_super_admin_all ON public.system_api_keys;
CREATE POLICY system_api_keys_super_admin_all ON public.system_api_keys
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
REVOKE ALL ON public.system_api_keys FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_system_api_key(p_name text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_key_plain text;
  v_hash text;
BEGIN
  v_actor := auth.uid();
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0001';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 3 THEN
    RAISE EXCEPTION 'name_required' USING ERRCODE = 'P0001';
  END IF;

  v_key_plain := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_key_plain, 'sha256'), 'hex');

  INSERT INTO public.system_api_keys(name, key_hash, created_by)
  VALUES (trim(p_name), v_hash, v_actor);

  PERFORM public.append_system_audit_log(
    v_actor, NULL, NULL,
    'admin:system_api_key:create',
    'System API key created (hash stored; plaintext returned once)',
    NULL, NULL,
    jsonb_build_object('name', trim(p_name))
  );

  PERFORM public.write_audit_log(
    p_actor_id := v_actor,
    p_actor_email := NULL,
    p_actor_role := 'super_admin',
    p_action := 'SYSTEM_API_KEY_CREATED',
    p_resource_type := 'system_api_keys',
    p_resource_id := trim(p_name),
    p_new_value := jsonb_build_object('name', trim(p_name)),
    p_metadata := jsonb_build_object('note', 'Plaintext key returned once; store securely.')
  );

  RETURN jsonb_build_object('name', trim(p_name), 'api_key', v_key_plain);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_system_api_key(p_name text, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.system_api_keys
  SET revoked_at = now(),
      revoked_by = v_actor,
      revoked_reason = trim(p_reason)
  WHERE name = trim(p_name)
    AND revoked_at IS NULL;

  PERFORM public.append_system_audit_log(
    v_actor, NULL, NULL,
    'admin:system_api_key:revoke',
    'System API key revoked',
    NULL, NULL,
    jsonb_build_object('name', trim(p_name), 'reason', trim(p_reason))
  );

  PERFORM public.write_audit_log(
    p_actor_id := v_actor,
    p_actor_email := NULL,
    p_actor_role := 'super_admin',
    p_action := 'SYSTEM_API_KEY_REVOKED',
    p_resource_type := 'system_api_keys',
    p_resource_id := trim(p_name),
    p_new_value := jsonb_build_object('name', trim(p_name), 'reason', trim(p_reason))
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_system_api_key(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_system_api_key(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_system_api_key(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_system_api_key(text, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4) Support oversight log (if you want a generic name; you already have support_actions_log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  action_description text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ticket_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS support_logs_super_admin_read ON public.support_logs;
CREATE POLICY support_logs_super_admin_read ON public.support_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS support_logs_support_insert ON public.support_logs;
CREATE POLICY support_logs_support_insert ON public.support_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('support','admin','system_admin','super_admin')
    )
  );
REVOKE UPDATE, DELETE ON public.support_logs FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5) Security monitoring: suspicious activity flags derived from audit_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  flag_type text NOT NULL, -- e.g. 'rapid_deletes', 'role_escalation'
  severity int NOT NULL DEFAULT 2 CHECK (severity BETWEEN 1 AND 5),
  summary text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.security_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS security_flags_super_admin_read ON public.security_flags;
CREATE POLICY security_flags_super_admin_read ON public.security_flags
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS security_flags_service_insert ON public.security_flags;
CREATE POLICY security_flags_service_insert ON public.security_flags
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role' OR public.is_super_admin(auth.uid()));
REVOKE UPDATE, DELETE ON public.security_flags FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.flag_suspicious_activity(
  p_window interval DEFAULT interval '10 minutes',
  p_delete_threshold int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_now timestamptz;
  v_inserted int := 0;
BEGIN
  v_actor := auth.uid();
  IF NOT public.is_super_admin(v_actor) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_now := now();

  -- Rapid deletes by actor across critical tables (based on trigger-based audit entries).
  INSERT INTO public.security_flags(actor_id, flag_type, severity, summary, evidence)
  SELECT
    al.actor_id,
    'rapid_deletes',
    4,
    'High volume DELETE operations in a short window',
    jsonb_build_object(
      'window', p_window::text,
      'count', count(*),
      'tables', jsonb_agg(DISTINCT al.table_name),
      'first', min(al.created_at),
      'last', max(al.created_at)
    )
  FROM public.audit_logs al
  WHERE al.created_at >= (v_now - p_window)
    AND al.action = 'DELETE'
    AND al.table_name IS NOT NULL
    AND al.actor_id IS NOT NULL
  GROUP BY al.actor_id
  HAVING count(*) >= greatest(1, p_delete_threshold)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Role escalation attempts (changes to user_roles) in the same window.
  INSERT INTO public.security_flags(actor_id, flag_type, severity, summary, evidence)
  SELECT
    al.actor_id,
    'role_escalation',
    5,
    'Role changes detected (review for privilege escalation)',
    jsonb_build_object(
      'window', p_window::text,
      'events', jsonb_agg(jsonb_build_object(
        'at', al.created_at,
        'record_id', al.record_id,
        'old', al.old_data,
        'new', al.new_data
      ) ORDER BY al.created_at DESC)
    )
  FROM public.audit_logs al
  WHERE al.created_at >= (v_now - p_window)
    AND al.table_name = 'user_roles'
    AND al.action IN ('INSERT','UPDATE','DELETE')
    AND al.actor_id IS NOT NULL
  GROUP BY al.actor_id
  HAVING count(*) >= 1;

  RETURN jsonb_build_object('ok', true, 'flagged', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.flag_suspicious_activity(interval, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flag_suspicious_activity(interval, int) TO authenticated, service_role;

COMMIT;

