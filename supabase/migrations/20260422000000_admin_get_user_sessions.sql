-- Create a function to allow admins to view user sessions
CREATE OR REPLACE FUNCTION admin_get_user_sessions(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  ip VARCHAR,
  user_agent VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Verify the caller is an admin
  v_caller_role := get_my_role();
  
  IF v_caller_role NOT IN ('super_admin', 'system_admin', 'admin') THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.created_at,
    s.updated_at,
    s.ip::VARCHAR,
    s.user_agent::VARCHAR
  FROM auth.sessions s
  WHERE s.user_id = p_user_id
  ORDER BY s.updated_at DESC;
END;
$$;
-- Grant access
GRANT EXECUTE ON FUNCTION admin_get_user_sessions TO authenticated;
