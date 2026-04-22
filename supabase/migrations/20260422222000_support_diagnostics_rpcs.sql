-- Support diagnostics RPCs (idempotent)
-- - support_get_user_sessions: read-only, requires canViewSessions
-- - support_get_user_activity_logs: read-only, requires canViewActivityLogs

-- Helper: evaluate a boolean permission from get_my_support_permissions()
CREATE OR REPLACE FUNCTION public.support_has_permission(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((public.get_my_support_permissions() ->> p_key)::boolean, false);
$$;

REVOKE ALL ON FUNCTION public.support_has_permission FROM anon;
GRANT EXECUTE ON FUNCTION public.support_has_permission TO authenticated;

-- Sessions (subset of auth.sessions)
CREATE OR REPLACE FUNCTION public.support_get_user_sessions(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  ip varchar,
  user_agent varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.support_has_permission('canViewSessions') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.created_at,
    s.updated_at,
    s.ip::varchar,
    s.user_agent::varchar
  FROM auth.sessions s
  WHERE s.user_id = p_user_id
  ORDER BY s.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_user_sessions FROM anon;
GRANT EXECUTE ON FUNCTION public.support_get_user_sessions TO authenticated;

-- Activity logs
CREATE OR REPLACE FUNCTION public.support_get_user_activity_logs(p_user_id uuid, p_limit int DEFAULT 200)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  action_type text,
  status text,
  ip_address text,
  device_info text,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.support_has_permission('canViewActivityLogs') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    ual.id,
    ual.created_at,
    ual.action_type,
    ual.status,
    ual.ip_address,
    ual.device_info,
    ual.metadata
  FROM public.user_activity_logs ual
  WHERE ual.user_id = p_user_id
  ORDER BY ual.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
END;
$$;

REVOKE ALL ON FUNCTION public.support_get_user_activity_logs FROM anon;
GRANT EXECUTE ON FUNCTION public.support_get_user_activity_logs TO authenticated;

