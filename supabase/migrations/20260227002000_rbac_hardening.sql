-- ============================================================
-- MUSHIN — RBAC Hardening
-- Migration: 20260227002000_rbac_hardening.sql
-- Single source of truth: user_roles table
-- Roles: super_admin > admin > support > viewer > user
-- ============================================================

-- NOTE: `user_roles` may already exist (created by earlier migrations) and may use
-- an enum type for `role`. This migration only *adds* missing columns and policies
-- without assuming a particular role column type.
CREATE TABLE IF NOT EXISTS user_roles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL,
  UNIQUE (user_id, role)
);

DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_roles' AND column_name='granted_by') THEN
    ALTER TABLE user_roles ADD COLUMN granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_roles' AND column_name='granted_at') THEN
    ALTER TABLE user_roles ADD COLUMN granted_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_roles' AND column_name='revoked_at') THEN
    ALTER TABLE user_roles ADD COLUMN revoked_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_roles' AND column_name='note') THEN
    ALTER TABLE user_roles ADD COLUMN note text;
  END IF;
  
  -- Avoid hard check constraints here because older schemas may use enums.

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') THEN
    ALTER TABLE public.profiles ADD COLUMN email text;
  END IF;
END $$;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_read_roles" ON user_roles;
CREATE POLICY "superadmin_read_roles" ON user_roles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_roles ur2
      WHERE ur2.user_id = auth.uid()
      AND ur2.role IN ('super_admin', 'admin', 'support')
      AND ur2.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "superadmin_grant_roles" ON user_roles;
CREATE POLICY "superadmin_grant_roles" ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur2
      WHERE ur2.user_id = auth.uid()
      AND ur2.role = 'super_admin'
      AND ur2.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "superadmin_revoke_roles" ON user_roles;
CREATE POLICY "superadmin_revoke_roles" ON user_roles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur2
      WHERE ur2.user_id = auth.uid()
      AND ur2.role = 'super_admin'
      AND ur2.revoked_at IS NULL
    )
  )
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = auth.uid()
    AND revoked_at IS NULL
  ORDER BY
    CASE role
      WHEN 'super_admin'  THEN 1
      WHEN 'system_admin' THEN 2
      WHEN 'admin'        THEN 3
      WHEN 'support'      THEN 4
      WHEN 'viewer'       THEN 5
      ELSE 6
    END
  LIMIT 1;
  RETURN COALESCE(v_role, 'user');
END;
$$;

CREATE TABLE IF NOT EXISTS user_suspensions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  suspended_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason        text,
  suspended_at  timestamptz NOT NULL DEFAULT now(),
  lifted_at     timestamptz,
  lift_reason   text
);

ALTER TABLE user_suspensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_suspensions" ON user_suspensions;
CREATE POLICY "admin_manage_suspensions" ON user_suspensions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "user_read_own_suspension" ON user_suspensions;
CREATE POLICY "user_read_own_suspension" ON user_suspensions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS revoked_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reason        text,
  revoked_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE revoked_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_revocations" ON revoked_sessions;
CREATE POLICY "admin_manage_revocations" ON revoked_sessions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND revoked_at IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_user_suspensions_user_id ON user_suspensions (user_id);

