-- ============================================================================
-- Super Admin Recovery & Security System (production-grade)
-- Migration: 20260422153000_super_admin_recovery_security.sql
--
-- This migration is additive-only (no breaking schema). It complements existing:
-- - `public.audit_logs` (immutable append-only) from `20260227001000_audit_logs.sql`
-- - `public.system_audit_logs` (tamper-evident hash chain) + snapshot restore control plane
--
-- What this adds:
-- - PITR readiness documentation (comments) + restoration runbook pointers
-- - Immutable audit logging that matches the requested shape (table/record + old/new jsonb)
-- - Row versioning history tables for critical tables
-- - Super-admin-only rollback: `public.restore_table_to_timestamp(table_name, ts, ...)`
-- - Defense-in-depth hardening: block direct deletes on critical tables (service-role only)
-- - Placeholder secrets rotation request hook (logs only; does not rotate secrets)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) PITR readiness documentation (Supabase manages WAL/PITR at the platform level)
-- ----------------------------------------------------------------------------
COMMENT ON SCHEMA public IS
  'Recovery notes: Supabase PITR uses WAL-based backups (platform feature). For full DB rewind, use Supabase Dashboard PITR/backup restore to a timestamp. For targeted rollback of critical tables, use public.restore_table_to_timestamp(...) (super_admin only), which replays table history tables created by this migration.';

-- ----------------------------------------------------------------------------
-- 2) Super-admin predicate (do not assume system_admin implies super_admin)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id uuid DEFAULT auth.uid())
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
  -- `user_roles` shape varies across historical migrations. Some environments include `revoked_at`.
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
           AND ur.role::text = ''super_admin''
           AND ur.revoked_at IS NULL
       )'
    INTO v_is
    USING p_user_id;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = p_user_id
        AND ur.role::text = 'super_admin'
    ) INTO v_is;
  END IF;

  RETURN COALESCE(v_is, false);
END;
$$;

-- ----------------------------------------------------------------------------
-- 3) Upgrade `public.audit_logs` to the required column set (additive)
-- ----------------------------------------------------------------------------
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS table_name text,
  ADD COLUMN IF NOT EXISTS record_id text,
  ADD COLUMN IF NOT EXISTS old_data jsonb,
  ADD COLUMN IF NOT EXISTS new_data jsonb;

COMMENT ON COLUMN public.audit_logs.action IS
  'Action name. For trigger-based table auditing this stores TG_OP (INSERT/UPDATE/DELETE). For application-level events (LOGIN, credits.adjust, etc.) this may store a domain action.';

COMMENT ON COLUMN public.audit_logs.table_name IS
  'When present, the audited table name for trigger-based auditing.';
COMMENT ON COLUMN public.audit_logs.record_id IS
  'When present, the primary identifier (or composite key string) of the affected record.';
COMMENT ON COLUMN public.audit_logs.old_data IS
  'Full previous row state (jsonb) for UPDATE/DELETE when available.';
COMMENT ON COLUMN public.audit_logs.new_data IS
  'Full new row state (jsonb) for INSERT/UPDATE when available.';

-- RLS: enforce "view audit logs = super_admin only" (requirement)
-- Keep INSERT available to privileged staff/service processes (append-only).
DROP POLICY IF EXISTS admin_read_audit ON public.audit_logs;
CREATE POLICY super_admin_read_audit_logs ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS admin_insert_audit ON public.audit_logs;
CREATE POLICY privileged_insert_audit_logs ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('super_admin', 'admin', 'support', 'system_admin')
    )
  );

-- ----------------------------------------------------------------------------
-- 4) Trigger-based immutable audit logging for critical tables
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_critical_table_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role text;
  v_table text;
  v_record_id text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  v_actor_id := public.current_actor_user_id();
  IF v_actor_id IS NULL THEN
    v_actor_id := auth.uid();
  END IF;

  SELECT ur.role::text INTO v_actor_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_actor_id
  LIMIT 1;

  v_table := TG_TABLE_NAME;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  END IF;

  -- Best-effort record_id extraction:
  -- - prefers `id`
  -- - supports composite keys by building a stable string for known tables
  v_record_id := COALESCE(
    CASE
      WHEN v_table = 'workspace_members' THEN COALESCE((COALESCE(v_new, v_old)->>'workspace_id'), '') || ':' || COALESCE((COALESCE(v_new, v_old)->>'user_id'), '')
      WHEN v_table = 'user_roles' THEN COALESCE((COALESCE(v_new, v_old)->>'user_id'), '')
      ELSE COALESCE((COALESCE(v_new, v_old)->>'id'), '')
    END,
    ''
  );

  -- Insert an immutable log entry.
  -- We populate both legacy columns (old_value/new_value) and the required columns (old_data/new_data).
  INSERT INTO public.audit_logs (
    actor_id,
    actor_email,
    actor_role,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    old_value,
    new_value,
    metadata,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    v_actor_id,
    NULL,
    COALESCE(v_actor_role, 'unknown'),
    TG_OP,
    'table',
    v_table,
    NULL,
    NULL,
    v_old,
    v_new,
    jsonb_build_object('source', 'db_trigger', 'table', v_table, 'record_id', v_record_id),
    v_table,
    v_record_id,
    v_old,
    v_new
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5) Row versioning (history tables) for critical tables
-- ----------------------------------------------------------------------------
-- We store the full row as jsonb to avoid breaking changes when base tables evolve.
CREATE OR REPLACE FUNCTION public.write_row_history(p_table_name text, p_record_id text, p_op text, p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor_id uuid;
  v_actor_role text;
BEGIN
  v_actor_id := public.current_actor_user_id();
  IF v_actor_id IS NULL THEN
    v_actor_id := auth.uid();
  END IF;

  SELECT ur.role::text INTO v_actor_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_actor_id
  LIMIT 1;

  INSERT INTO public.critical_row_history (
    table_name,
    record_id,
    op,
    actor_id,
    actor_role,
    row_data
  ) VALUES (
    p_table_name,
    p_record_id,
    p_op,
    v_actor_id,
    v_actor_role,
    p_row
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.critical_row_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  op text NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  row_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_critical_row_history_lookup
  ON public.critical_row_history (table_name, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_critical_row_history_created_at
  ON public.critical_row_history (created_at DESC);

ALTER TABLE public.critical_row_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS critical_row_history_read_super_admin ON public.critical_row_history;
CREATE POLICY critical_row_history_read_super_admin ON public.critical_row_history
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
REVOKE UPDATE, DELETE ON public.critical_row_history FROM anon, authenticated;
DROP POLICY IF EXISTS critical_row_history_insert_privileged ON public.critical_row_history;
CREATE POLICY critical_row_history_insert_privileged ON public.critical_row_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('super_admin', 'admin', 'support', 'system_admin')
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_critical_row_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'critical_row_history is immutable';
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_critical_row_history_mutation ON public.critical_row_history;
CREATE TRIGGER trg_prevent_critical_row_history_mutation
  BEFORE UPDATE OR DELETE ON public.critical_row_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_critical_row_history_mutation();

CREATE OR REPLACE FUNCTION public.capture_critical_row_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table text;
  v_record_id text;
  v_row jsonb;
BEGIN
  v_table := TG_TABLE_NAME;

  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;

  v_record_id := COALESCE(
    CASE
      WHEN v_table = 'workspace_members' THEN COALESCE((v_row->>'workspace_id'), '') || ':' || COALESCE((v_row->>'user_id'), '')
      WHEN v_table = 'user_roles' THEN COALESCE((v_row->>'user_id'), '')
      ELSE COALESCE((v_row->>'id'), '')
    END,
    ''
  );

  PERFORM public.write_row_history(v_table, v_record_id, TG_OP, v_row);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6) Safety hardening: deny direct deletes on critical tables (service-role only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_delete_unless_service_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Direct deletes are disabled for critical tables (use soft-delete or privileged restore)' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7) Attach audit + history + delete-protection triggers to critical tables
-- ----------------------------------------------------------------------------
-- We use DO blocks so the migration is safe even if some tables are absent in a given environment.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles',
    'workspaces',
    'workspace_members',
    'user_roles',
    'subscriptions',
    'paddle_subscriptions',
    'usage_limits',
    'credit_transactions',
    'support_tickets',
    'support_ticket_replies',
    'support_staff_rbac'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_critical_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_audit_critical_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_critical_table_write()', t, t);

      EXECUTE format('DROP TRIGGER IF EXISTS trg_history_critical_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_history_critical_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_critical_row_history()', t, t);

      -- Delete blocking is intentionally NOT applied to join/role edges where the app may legitimately delete rows.
      -- For those tables we rely on RLS/privileged APIs instead of hard blocking at the trigger layer.
      IF t IN ('profiles','workspaces','subscriptions','paddle_subscriptions','usage_limits','credit_transactions','support_tickets','support_staff_rbac') THEN
        EXECUTE format('DROP TRIGGER IF EXISTS trg_prevent_delete_%I ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER trg_prevent_delete_%I BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_unless_service_role()', t, t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 8) Super-admin-only audit log access RPC (server-side filtering; no client trust)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_limit int DEFAULT 200,
  p_since timestamptz DEFAULT NULL,
  p_table_name text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  actor_id uuid,
  actor_role text,
  action text,
  table_name text,
  record_id text,
  ip_address inet,
  created_at timestamptz,
  old_data jsonb,
  new_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      al.id,
      al.actor_id,
      al.actor_role,
      al.action,
      al.table_name,
      al.record_id,
      al.ip_address,
      al.created_at,
      CASE
        WHEN al.table_name IN ('workspace_secrets') THEN NULL
        ELSE al.old_data
      END AS old_data,
      CASE
        WHEN al.table_name IN ('workspace_secrets') THEN NULL
        ELSE al.new_data
      END AS new_data
    FROM public.audit_logs al
    WHERE (p_since IS NULL OR al.created_at >= p_since)
      AND (p_table_name IS NULL OR al.table_name = p_table_name)
    ORDER BY al.created_at DESC
    LIMIT greatest(1, least(p_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.get_audit_logs(int, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_audit_logs(int, timestamptz, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9) Rollback mechanism: restore_table_to_timestamp(table_name, timestamp)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_table_to_timestamp(
  p_table_name text,
  p_timestamp timestamptz,
  p_confirm boolean DEFAULT false,
  p_reason text DEFAULT NULL,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_allowed boolean;
  v_result jsonb;
BEGIN
  v_actor := auth.uid();
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_allowed := p_table_name IN (
    'profiles',
    'workspaces',
    'workspace_members',
    'user_roles',
    'subscriptions',
    'paddle_subscriptions',
    'usage_limits',
    'credit_transactions',
    'support_tickets',
    'support_ticket_replies',
    'support_staff_rbac'
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'table_not_allowed' USING ERRCODE = 'P0001';
  END IF;

  IF NOT p_dry_run THEN
    IF NOT p_confirm THEN
      RAISE EXCEPTION 'confirmation_required' USING ERRCODE = 'P0001';
    END IF;
    IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
      RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- We implement restore using history snapshots stored in `public.critical_row_history`.
  -- Strategy:
  -- - Compute the desired "as-of" row snapshot for the requested timestamp.
  -- - For dry-run: return counts only.
  -- - For execute: apply changes with service-definer privileges.
  --
  -- This is designed to be table-safe and avoids dynamic json->record casting to prevent silent schema drift.
  -- For now we support robust restoration for a subset of tables that are central to platform compromise recovery.

  -- Use dynamic dispatch so this function can be created before helper functions
  -- in the same migration (forward-reference safe).
  IF p_table_name IN ('profiles','workspaces','workspace_members','user_roles','subscriptions') THEN
    EXECUTE format('SELECT public.restore_%s_to_timestamp($1,$2)', p_table_name)
      INTO v_result
      USING p_timestamp, p_dry_run;
  ELSE
    -- Allowlisted but not yet implemented with schema-safe casting.
    RAISE EXCEPTION 'restore_not_implemented_for_table' USING ERRCODE = 'P0001';
  END IF;

  -- Audit the rollback request in BOTH audit systems.
  PERFORM public.append_system_audit_log(
    v_actor,
    NULL,
    NULL,
    CASE WHEN p_dry_run THEN 'admin:rollback:dry_run' ELSE 'admin:rollback:execute' END,
    'restore_table_to_timestamp executed for ' || p_table_name,
    NULL,
    NULL,
    jsonb_build_object('table', p_table_name, 'timestamp', p_timestamp, 'reason', p_reason, 'result', v_result)
  );

  PERFORM public.write_audit_log(
    p_actor_id      := v_actor,
    p_actor_email   := NULL,
    p_actor_role    := 'super_admin',
    p_action        := CASE WHEN p_dry_run THEN 'ROLLBACK_DRY_RUN' ELSE 'ROLLBACK_EXECUTE' END,
    p_resource_type := 'table',
    p_resource_id   := p_table_name,
    p_old_value     := NULL,
    p_new_value     := jsonb_build_object('timestamp', p_timestamp, 'result', v_result, 'reason', p_reason),
    p_metadata      := jsonb_build_object('mechanism', 'critical_row_history')
  );

  RETURN jsonb_build_object(
    'table', p_table_name,
    'timestamp', p_timestamp,
    'dry_run', p_dry_run,
    'result', v_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.restore_table_to_timestamp(text, timestamptz, boolean, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_table_to_timestamp(text, timestamptz, boolean, text, boolean) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 9a) Table-specific restore helpers (schema-safe: explicit column mapping)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_profiles_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_upsert bigint;
  v_to_soft_delete bigint;
BEGIN
  -- Desired snapshot per user id.
  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      h.row_data->>'full_name' AS full_name,
      h.row_data->>'avatar_url' AS avatar_url,
      COALESCE((h.row_data->>'onboarding_completed')::boolean, false) AS onboarding_completed,
      (h.row_data->>'consent_given_at')::timestamptz AS consent_given_at,
      (h.row_data->>'created_at')::timestamptz AS created_at,
      (h.row_data->>'updated_at')::timestamptz AS updated_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'profiles'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  ),
  current_ids AS (
    SELECT p.id::text AS record_id
    FROM public.profiles p
  ),
  desired_ids AS (
    SELECT d.id::text AS record_id FROM desired d
  )
  SELECT
    (SELECT count(*) FROM desired) AS to_upsert,
    (SELECT count(*) FROM current_ids ci LEFT JOIN desired_ids di ON di.record_id = ci.record_id WHERE di.record_id IS NULL) AS to_soft_delete
  INTO v_to_upsert, v_to_soft_delete;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_upsert', v_to_upsert, 'to_soft_delete', v_to_soft_delete);
  END IF;

  -- Ensure soft-delete column exists (additive).
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      h.row_data->>'full_name' AS full_name,
      h.row_data->>'avatar_url' AS avatar_url,
      COALESCE((h.row_data->>'onboarding_completed')::boolean, false) AS onboarding_completed,
      (h.row_data->>'consent_given_at')::timestamptz AS consent_given_at,
      (h.row_data->>'created_at')::timestamptz AS created_at,
      (h.row_data->>'updated_at')::timestamptz AS updated_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'profiles'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  )
  INSERT INTO public.profiles (id, full_name, avatar_url, onboarding_completed, consent_given_at, created_at, updated_at, deleted_at)
  SELECT d.id, d.full_name, d.avatar_url, d.onboarding_completed, d.consent_given_at, d.created_at, d.updated_at, NULL
  FROM desired d
  ON CONFLICT (id) DO UPDATE SET
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    onboarding_completed = excluded.onboarding_completed,
    consent_given_at = excluded.consent_given_at,
    updated_at = COALESCE(excluded.updated_at, now()),
    deleted_at = NULL;

  -- Soft-delete rows that should not exist as-of timestamp.
  UPDATE public.profiles p
  SET deleted_at = now()
  WHERE p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.critical_row_history h
      WHERE h.table_name = 'profiles'
        AND h.record_id = p.id::text
        AND h.created_at <= p_timestamp
    );

  RETURN jsonb_build_object('restored', true, 'to_upsert', v_to_upsert, 'soft_deleted', v_to_soft_delete);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_workspaces_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_upsert bigint;
  v_to_soft_delete bigint;
BEGIN
  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'owner_id')::uuid AS owner_id,
      h.row_data->>'name' AS name,
      COALESCE(h.row_data->>'plan', 'free') AS plan,
      (h.row_data->>'settings')::jsonb AS settings,
      (h.row_data->>'created_at')::timestamptz AS created_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'workspaces'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  ),
  current_ids AS (
    SELECT w.id::text AS record_id
    FROM public.workspaces w
  ),
  desired_ids AS (
    SELECT d.id::text AS record_id FROM desired d
  )
  SELECT
    (SELECT count(*) FROM desired) AS to_upsert,
    (SELECT count(*) FROM current_ids ci LEFT JOIN desired_ids di ON di.record_id = ci.record_id WHERE di.record_id IS NULL) AS to_soft_delete
  INTO v_to_upsert, v_to_soft_delete;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_upsert', v_to_upsert, 'to_soft_delete', v_to_soft_delete);
  END IF;

  ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'owner_id')::uuid AS owner_id,
      h.row_data->>'name' AS name,
      COALESCE(h.row_data->>'plan', 'free') AS plan,
      COALESCE((h.row_data->>'settings')::jsonb, '{}'::jsonb) AS settings,
      (h.row_data->>'created_at')::timestamptz AS created_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'workspaces'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  )
  INSERT INTO public.workspaces (id, owner_id, name, plan, settings, created_at, deleted_at)
  SELECT d.id, d.owner_id, d.name, d.plan, d.settings, COALESCE(d.created_at, now()), NULL
  FROM desired d
  ON CONFLICT (id) DO UPDATE SET
    owner_id = excluded.owner_id,
    name = excluded.name,
    plan = excluded.plan,
    settings = excluded.settings,
    deleted_at = NULL;

  UPDATE public.workspaces w
  SET deleted_at = now()
  WHERE w.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.critical_row_history h
      WHERE h.table_name = 'workspaces'
        AND h.record_id = w.id::text
        AND h.created_at <= p_timestamp
    );

  RETURN jsonb_build_object('restored', true, 'to_upsert', v_to_upsert, 'soft_deleted', v_to_soft_delete);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_workspace_members_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_upsert bigint;
  v_to_delete bigint;
BEGIN
  -- workspace_members is a join table; we restore membership edges and hard-delete edges created after timestamp.
  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'workspace_id')::uuid AS workspace_id,
      (h.row_data->>'user_id')::uuid AS user_id,
      COALESCE((h.row_data->>'role')::public.workspace_role, 'member'::public.workspace_role) AS role,
      (h.row_data->>'created_at')::timestamptz AS created_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'workspace_members'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  ),
  current_edges AS (
    SELECT (wm.workspace_id::text || ':' || wm.user_id::text) AS record_id
    FROM public.workspace_members wm
  ),
  desired_edges AS (
    SELECT (d.workspace_id::text || ':' || d.user_id::text) AS record_id
    FROM desired d
  )
  SELECT
    (SELECT count(*) FROM desired) AS to_upsert,
    (SELECT count(*) FROM current_edges ce LEFT JOIN desired_edges de ON de.record_id = ce.record_id WHERE de.record_id IS NULL) AS to_delete
  INTO v_to_upsert, v_to_delete;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_upsert', v_to_upsert, 'to_delete_edges', v_to_delete);
  END IF;

  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'workspace_id')::uuid AS workspace_id,
      (h.row_data->>'user_id')::uuid AS user_id,
      COALESCE((h.row_data->>'role')::public.workspace_role, 'member'::public.workspace_role) AS role,
      (h.row_data->>'created_at')::timestamptz AS created_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'workspace_members'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  )
  INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at)
  SELECT d.workspace_id, d.user_id, d.role, COALESCE(d.created_at, now())
  FROM desired d
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET
    role = excluded.role;

  -- Remove edges not present as-of timestamp.
  DELETE FROM public.workspace_members wm
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.critical_row_history h
    WHERE h.table_name = 'workspace_members'
      AND h.record_id = (wm.workspace_id::text || ':' || wm.user_id::text)
      AND h.created_at <= p_timestamp
  );

  RETURN jsonb_build_object('restored', true, 'to_upsert', v_to_upsert, 'deleted_edges', v_to_delete);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_user_roles_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_upsert bigint;
  v_to_delete bigint;
BEGIN
  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'user_id')::uuid AS user_id,
      (h.row_data->>'role')::public.app_role AS role
    FROM public.critical_row_history h
    WHERE h.table_name = 'user_roles'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  ),
  current_ids AS (
    SELECT ur.user_id::text AS record_id
    FROM public.user_roles ur
  ),
  desired_ids AS (
    SELECT d.user_id::text AS record_id FROM desired d
  )
  SELECT
    (SELECT count(*) FROM desired) AS to_upsert,
    (SELECT count(*) FROM current_ids ci LEFT JOIN desired_ids di ON di.record_id = ci.record_id WHERE di.record_id IS NULL) AS to_delete
  INTO v_to_upsert, v_to_delete;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_upsert', v_to_upsert, 'to_delete', v_to_delete);
  END IF;

  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'user_id')::uuid AS user_id,
      (h.row_data->>'role')::public.app_role AS role
    FROM public.critical_row_history h
    WHERE h.table_name = 'user_roles'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  )
  INSERT INTO public.user_roles (user_id, role)
  SELECT d.user_id, COALESCE(d.role, 'user'::public.app_role)
  FROM desired d
  ON CONFLICT (user_id) DO UPDATE SET
    role = excluded.role;

  -- Remove roles created after timestamp (rare; but prevents privilege persistence).
  DELETE FROM public.user_roles ur
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.critical_row_history h
    WHERE h.table_name = 'user_roles'
      AND h.record_id = ur.user_id::text
      AND h.created_at <= p_timestamp
  );

  RETURN jsonb_build_object('restored', true, 'to_upsert', v_to_upsert, 'deleted', v_to_delete);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_subscriptions_to_timestamp(p_timestamp timestamptz, p_dry_run boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_to_upsert bigint;
  v_to_soft_delete bigint;
BEGIN
  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'workspace_id')::uuid AS workspace_id,
      COALESCE(h.row_data->>'plan', 'free') AS plan,
      COALESCE(h.row_data->>'status', 'active') AS status,
      h.row_data->>'stripe_customer_id' AS stripe_customer_id,
      h.row_data->>'stripe_subscription_id' AS stripe_subscription_id,
      (h.row_data->>'current_period_start')::timestamptz AS current_period_start,
      (h.row_data->>'current_period_end')::timestamptz AS current_period_end,
      COALESCE((h.row_data->>'cancel_at_period_end')::boolean, false) AS cancel_at_period_end,
      (h.row_data->>'created_at')::timestamptz AS created_at,
      (h.row_data->>'updated_at')::timestamptz AS updated_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'subscriptions'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  ),
  current_ids AS (
    SELECT s.workspace_id::text AS record_id
    FROM public.subscriptions s
  ),
  desired_ids AS (
    SELECT d.workspace_id::text AS record_id FROM desired d
  )
  SELECT
    (SELECT count(*) FROM desired) AS to_upsert,
    (SELECT count(*) FROM current_ids ci LEFT JOIN desired_ids di ON di.record_id = ci.record_id WHERE di.record_id IS NULL) AS to_soft_delete
  INTO v_to_upsert, v_to_soft_delete;

  IF p_dry_run THEN
    RETURN jsonb_build_object('to_upsert', v_to_upsert, 'to_soft_delete', v_to_soft_delete);
  END IF;

  ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

  WITH desired AS (
    SELECT DISTINCT ON (h.record_id)
      (h.row_data->>'id')::uuid AS id,
      (h.row_data->>'workspace_id')::uuid AS workspace_id,
      COALESCE(h.row_data->>'plan', 'free') AS plan,
      COALESCE(h.row_data->>'status', 'active') AS status,
      h.row_data->>'stripe_customer_id' AS stripe_customer_id,
      h.row_data->>'stripe_subscription_id' AS stripe_subscription_id,
      (h.row_data->>'current_period_start')::timestamptz AS current_period_start,
      (h.row_data->>'current_period_end')::timestamptz AS current_period_end,
      COALESCE((h.row_data->>'cancel_at_period_end')::boolean, false) AS cancel_at_period_end,
      (h.row_data->>'created_at')::timestamptz AS created_at,
      (h.row_data->>'updated_at')::timestamptz AS updated_at
    FROM public.critical_row_history h
    WHERE h.table_name = 'subscriptions'
      AND h.created_at <= p_timestamp
    ORDER BY h.record_id, h.created_at DESC, h.id DESC
  )
  INSERT INTO public.subscriptions (
    id,
    workspace_id,
    plan,
    status,
    stripe_customer_id,
    stripe_subscription_id,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    created_at,
    updated_at,
    deleted_at
  )
  SELECT
    d.id,
    d.workspace_id,
    d.plan,
    d.status,
    COALESCE(NULLIF(d.stripe_customer_id, ''), 'restored-' || d.workspace_id::text),
    d.stripe_subscription_id,
    d.current_period_start,
    d.current_period_end,
    d.cancel_at_period_end,
    COALESCE(d.created_at, now()),
    COALESCE(d.updated_at, now()),
    NULL
  FROM desired d
  ON CONFLICT (workspace_id) DO UPDATE SET
    plan = excluded.plan,
    status = excluded.status,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = excluded.updated_at,
    deleted_at = NULL;

  UPDATE public.subscriptions s
  SET deleted_at = now()
  WHERE s.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.critical_row_history h
      WHERE h.table_name = 'subscriptions'
        AND h.record_id = s.workspace_id::text
        AND h.created_at <= p_timestamp
    );

  RETURN jsonb_build_object('restored', true, 'to_upsert', v_to_upsert, 'soft_deleted', v_to_soft_delete);
END;
$$;

-- ----------------------------------------------------------------------------
-- 10) Secrets rotation hook (placeholder; logs only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.secrets_rotation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scope text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.secrets_rotation_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS secrets_rotation_requests_select_super_admin ON public.secrets_rotation_requests;
CREATE POLICY secrets_rotation_requests_select_super_admin ON public.secrets_rotation_requests
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS secrets_rotation_requests_insert_super_admin ON public.secrets_rotation_requests;
CREATE POLICY secrets_rotation_requests_insert_super_admin ON public.secrets_rotation_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
REVOKE UPDATE, DELETE ON public.secrets_rotation_requests FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_secrets_rotation(p_scope text, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_id uuid;
BEGIN
  v_actor := auth.uid();
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.secrets_rotation_requests (requested_by, scope, reason)
  VALUES (v_actor, COALESCE(NULLIF(trim(p_scope), ''), 'unspecified'), trim(p_reason))
  RETURNING id INTO v_id;

  PERFORM public.append_system_audit_log(
    v_actor,
    NULL,
    NULL,
    'admin:secrets_rotation:requested',
    'Super admin requested secrets rotation (manual runbook required)',
    NULL,
    NULL,
    jsonb_build_object('request_id', v_id, 'scope', p_scope, 'reason', p_reason)
  );

  PERFORM public.write_audit_log(
    p_actor_id      := v_actor,
    p_actor_email   := NULL,
    p_actor_role    := 'super_admin',
    p_action        := 'SECRETS_ROTATION_REQUESTED',
    p_resource_type := 'secrets',
    p_resource_id   := p_scope,
    p_new_value     := jsonb_build_object('request_id', v_id, 'reason', p_reason),
    p_metadata      := jsonb_build_object('note', 'Rotation performed outside DB; this records intent and timing.')
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_secrets_rotation(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_secrets_rotation(text, text) TO authenticated, service_role;

COMMIT;
