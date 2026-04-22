-- ============================================================================
-- Support Staff System (support_staff role + secure ticket messages + audit)
-- Migration: 20260422240000_support_staff_role_and_panel_api.sql
--
-- Goals:
-- - Introduce dedicated app role: `support_staff`
-- - Preserve existing `support` role behavior (backward compatible)
-- - Add `support_messages` with internal notes (not visible to end users)
-- - Ensure support operations are fully auditable via `public.system_audit_logs`
-- - Tighten support-only access patterns for the support panel (edge-only)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Add app_role enum value: support_staff (idempotent; safe across deployments)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'support_staff'
        AND enumtypid = 'public.app_role'::regtype
    ) THEN
      ALTER TYPE public.app_role ADD VALUE 'support_staff';
    END IF;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

COMMENT ON TYPE public.app_role IS
  'Application roles. `support_staff` is restricted to the /support panel and cannot access admin/system controls.';

-- ----------------------------------------------------------------------------
-- 2) Expand support predicate helpers to include support_staff
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_support_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('support', 'support_staff', 'admin', 'super_admin', 'system_admin')
      AND (revoked_at IS NULL OR NOT EXISTS (SELECT 1))
  );
$$;

-- Also expose an explicit support-staff predicate (used by edge + RLS).
CREATE OR REPLACE FUNCTION public.is_support_staff(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_revoked_at boolean;
  v_is boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_roles'
      AND a.attname = 'revoked_at'
      AND a.attnum > 0
      AND NOT a.attisdropped
  ) INTO v_has_revoked_at;

  IF v_has_revoked_at THEN
    EXECUTE
      'SELECT EXISTS (
         SELECT 1
         FROM public.user_roles ur
         WHERE ur.user_id = $1
           AND ur.role::text IN (''support_staff'',''support'')
           AND ur.revoked_at IS NULL
       )'
    INTO v_is
    USING p_user_id;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = p_user_id
        AND ur.role::text IN ('support_staff','support')
    ) INTO v_is;
  END IF;

  RETURN COALESCE(v_is, false);
END;
$$;

REVOKE ALL ON FUNCTION public.is_support_staff(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_support_staff(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3) Support messages (replaces mixed use of admin_notes + replies for internal notes)
-- ----------------------------------------------------------------------------
-- End users can only see visibility='user'.
-- Support staff can see both and can post internal messages if tier allows.
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility text NOT NULL CHECK (visibility IN ('user','internal')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id_created
  ON public.support_messages(ticket_id, created_at ASC);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Users can read user-visible messages for their own tickets.
DROP POLICY IF EXISTS sm_user_read ON public.support_messages;
CREATE POLICY sm_user_read ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    visibility = 'user'
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id = ticket_id
        AND st.user_id = auth.uid()
    )
  );

-- Users can insert user-visible messages on their own tickets only.
DROP POLICY IF EXISTS sm_user_insert ON public.support_messages;
CREATE POLICY sm_user_insert ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    visibility = 'user'
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id = ticket_id
        AND st.user_id = auth.uid()
    )
  );

-- Support staff/admin can read all messages (user+internal).
DROP POLICY IF EXISTS sm_support_read_all ON public.support_messages;
CREATE POLICY sm_support_read_all ON public.support_messages
  FOR SELECT TO authenticated
  USING (public.is_support_or_admin());

-- Support staff can insert:
-- - visibility='user' replies (to communicate with user)
-- - visibility='internal' notes only if `get_my_support_permissions().canWriteInternalNotes`
DROP POLICY IF EXISTS sm_support_insert ON public.support_messages;
CREATE POLICY sm_support_insert ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_support_or_admin()
    AND author_id = auth.uid()
    AND (
      visibility = 'user'
      OR (
        visibility = 'internal'
        AND COALESCE((public.get_my_support_permissions()->>'canWriteInternalNotes')::boolean, false) = true
      )
    )
  );

REVOKE UPDATE, DELETE ON public.support_messages FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) Ensure support_staff can read/manage tickets (staff RLS)
-- ----------------------------------------------------------------------------
-- Extend staff policies to include `support_staff` alongside legacy `support`.
-- We create new policies rather than mutating older ones in-place.
DO $$
BEGIN
  -- Tickets: staff manage all.
  DROP POLICY IF EXISTS st_staff_all ON public.support_tickets;
  CREATE POLICY st_staff_all ON public.support_tickets
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND (ur.revoked_at IS NULL OR NOT EXISTS (SELECT 1))
          AND ur.role::text IN ('support', 'support_staff', 'admin', 'super_admin', 'system_admin')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND (ur.revoked_at IS NULL OR NOT EXISTS (SELECT 1))
          AND ur.role::text IN ('support', 'support_staff', 'admin', 'super_admin', 'system_admin')
      )
    );

  -- Replies table remains for backward compatibility; staff policy widened too.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='support_ticket_replies') THEN
    DROP POLICY IF EXISTS str_staff_all ON public.support_ticket_replies;
    CREATE POLICY str_staff_all ON public.support_ticket_replies
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (ur.revoked_at IS NULL OR NOT EXISTS (SELECT 1))
            AND ur.role::text IN ('support', 'support_staff', 'admin', 'super_admin', 'system_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND (ur.revoked_at IS NULL OR NOT EXISTS (SELECT 1))
            AND ur.role::text IN ('support', 'support_staff', 'admin', 'super_admin', 'system_admin')
        )
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5) Support audit to system_audit_logs for ALL support changes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.capture_support_system_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_target uuid;
  v_ws uuid;
  v_meta jsonb;
BEGIN
  v_actor := public.current_actor_user_id();
  IF v_actor IS NULL THEN
    v_actor := auth.uid();
  END IF;

  -- Target user/workspace where applicable.
  IF TG_TABLE_NAME = 'support_tickets' THEN
    v_target := COALESCE(NEW.user_id, OLD.user_id);
    v_ws := COALESCE(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'support_messages' THEN
    SELECT st.user_id, st.workspace_id INTO v_target, v_ws
    FROM public.support_tickets st
    WHERE st.id = COALESCE(NEW.ticket_id, OLD.ticket_id);
  ELSE
    v_target := NULL;
    v_ws := NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_meta := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    v_meta := jsonb_build_object('new', to_jsonb(NEW));
  ELSE
    v_meta := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  END IF;

  PERFORM public.append_system_audit_log(
    v_actor,
    v_target,
    v_ws,
    'support:' || TG_TABLE_NAME || ':' || TG_OP,
    'Support operation on ' || TG_TABLE_NAME,
    NULL,
    NULL,
    v_meta
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach to support_tickets + support_messages (replies remain as legacy).
DROP TRIGGER IF EXISTS trg_support_audit_tickets ON public.support_tickets;
CREATE TRIGGER trg_support_audit_tickets
  AFTER INSERT OR UPDATE OR DELETE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.capture_support_system_audit();

DROP TRIGGER IF EXISTS trg_support_audit_messages ON public.support_messages;
CREATE TRIGGER trg_support_audit_messages
  AFTER INSERT OR UPDATE OR DELETE ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.capture_support_system_audit();

COMMIT;

