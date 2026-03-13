-- Admin Control Plane
-- System-wide audit logs, admin activity views, credit/plan overrides, and restore points.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'system_admin';
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END
$$;
CREATE OR REPLACE FUNCTION public.current_actor_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sub text;
BEGIN
  v_sub := current_setting('request.jwt.claim.sub', true);
  IF v_sub IS NULL OR length(v_sub) = 0 THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_sub::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;
CREATE OR REPLACE FUNCTION public.is_system_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role::text = 'system_admin'
  );
$$;
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
  log_hash text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_ts ON public.system_audit_logs("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_actor ON public.system_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_target ON public.system_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_workspace ON public.system_audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_action_type ON public.system_audit_logs(action_type);
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_audit_logs_select_system_admin ON public.system_audit_logs;
CREATE POLICY system_audit_logs_select_system_admin ON public.system_audit_logs
  FOR SELECT USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS system_audit_logs_insert_service_role ON public.system_audit_logs;
CREATE POLICY system_audit_logs_insert_service_role ON public.system_audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
REVOKE UPDATE, DELETE ON public.system_audit_logs FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.prevent_system_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'system_audit_logs are immutable';
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_system_audit_mutation ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_system_audit_mutation
  BEFORE UPDATE OR DELETE ON public.system_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_system_audit_mutation();
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
  v_prev_hash text;
  v_new_hash text;
  v_id uuid;
BEGIN
  SELECT sal.log_hash
  INTO v_prev_hash
  FROM public.system_audit_logs sal
  ORDER BY sal."timestamp" DESC, sal.id DESC
  LIMIT 1;

  v_new_hash := encode(
    digest(
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
      'sha256'
    ),
    'hex'
  );

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
    v_new_hash
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.capture_table_write_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_workspace uuid;
  v_target uuid;
  v_meta jsonb;
BEGIN
  v_actor := public.current_actor_user_id();

  IF TG_TABLE_NAME = 'workspaces' THEN
    v_workspace := coalesce(NEW.id, OLD.id);
    v_target := coalesce(NEW.owner_id, OLD.owner_id);
  ELSIF TG_TABLE_NAME = 'workspace_members' THEN
    v_workspace := coalesce(NEW.workspace_id, OLD.workspace_id);
    v_target := coalesce(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'campaigns' THEN
    v_workspace := coalesce(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'enrichment_jobs' THEN
    v_workspace := coalesce(NEW.workspace_id, OLD.workspace_id);
    v_target := NULL;
  ELSIF TG_TABLE_NAME = 'subscriptions' THEN
    v_workspace := coalesce(NEW.workspace_id, OLD.workspace_id);
  ELSIF TG_TABLE_NAME = 'credits_usage' THEN
    v_workspace := coalesce(NEW.workspace_id, OLD.workspace_id);
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
    v_workspace,
    'db_write:' || TG_TABLE_NAME || ':' || TG_OP,
    'Database write operation on ' || TG_TABLE_NAME,
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
DROP TRIGGER IF EXISTS trg_audit_workspaces ON public.workspaces;
CREATE TRIGGER trg_audit_workspaces
  AFTER INSERT OR UPDATE OR DELETE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.capture_table_write_audit();
DROP TRIGGER IF EXISTS trg_audit_workspace_members ON public.workspace_members;
CREATE TRIGGER trg_audit_workspace_members
  AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.capture_table_write_audit();
DROP TRIGGER IF EXISTS trg_audit_campaigns ON public.campaigns;
CREATE TRIGGER trg_audit_campaigns
  AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.capture_table_write_audit();
DROP TRIGGER IF EXISTS trg_audit_enrichment_jobs ON public.enrichment_jobs;
CREATE TRIGGER trg_audit_enrichment_jobs
  AFTER INSERT OR UPDATE OR DELETE ON public.enrichment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.capture_table_write_audit();
DROP TRIGGER IF EXISTS trg_audit_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_audit_subscriptions
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.capture_table_write_audit();
DROP TRIGGER IF EXISTS trg_audit_credits_usage ON public.credits_usage;
CREATE TRIGGER trg_audit_credits_usage
  AFTER INSERT OR UPDATE OR DELETE ON public.credits_usage
  FOR EACH ROW EXECUTE FUNCTION public.capture_table_write_audit();
CREATE OR REPLACE VIEW public.admin_user_activity_view AS
SELECT
  p.id AS user_id,
  au.email,
  p.full_name,
  ur.role,
  coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'workspace_id', wm.workspace_id,
          'workspace_name', w.name,
          'membership_role', wm.role
        ) ORDER BY w.created_at DESC
      )
      FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = p.id
    ),
    '[]'::jsonb
  ) AS workspaces,
  (
    SELECT count(*)::bigint
    FROM public.campaigns c
    JOIN public.workspaces w ON w.id = c.workspace_id
    JOIN public.workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = p.id
  ) AS campaigns_created,
  (
    SELECT count(*)::bigint
    FROM public.enrichment_jobs ej
    JOIN public.workspace_members wm ON wm.workspace_id = ej.workspace_id
    WHERE wm.user_id = p.id
  ) AS enrichment_activity_count,
  (
    SELECT count(*)::bigint
    FROM public.search_history sh
    JOIN public.workspace_members wm ON wm.workspace_id = sh.workspace_id
    WHERE wm.user_id = p.id
  ) AS api_usage_count,
  (
    SELECT count(*)::bigint
    FROM public.credits_usage cu
    JOIN public.workspace_members wm ON wm.workspace_id = cu.workspace_id
    WHERE wm.user_id = p.id
  ) AS credit_usage_count,
  (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'timestamp', sal."timestamp",
        'action_type', sal.action_type,
        'description', sal.action_description,
        'ip_address', sal.ip_address,
        'user_agent', sal.user_agent
      ) ORDER BY sal."timestamp" DESC
    ), '[]'::jsonb)
    FROM public.system_audit_logs sal
    WHERE sal.actor_user_id = p.id
      AND sal.action_type = 'auth:login_attempt'
  ) AS login_history,
  (
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'timestamp', sal."timestamp",
        'action_type', sal.action_type,
        'description', sal.action_description,
        'metadata', sal.metadata_json
      ) ORDER BY sal."timestamp" DESC
    ), '[]'::jsonb)
    FROM public.system_audit_logs sal
    WHERE sal.actor_user_id = p.id
      AND (sal.action_type ILIKE '%suspicious%' OR sal.action_type ILIKE 'security:%')
  ) AS suspicious_activity
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE public.is_system_admin(auth.uid());
CREATE OR REPLACE VIEW public.admin_workspace_activity_view AS
SELECT
  w.id AS workspace_id,
  w.name,
  w.owner_id,
  au.email AS owner_email,
  w.plan,
  w.search_credits_remaining,
  w.ai_credits_remaining,
  w.email_sends_remaining,
  w.enrichment_credits_remaining,
  (
    SELECT count(*)::bigint
    FROM public.workspace_members wm
    WHERE wm.workspace_id = w.id
  ) AS member_count,
  (
    SELECT count(*)::bigint
    FROM public.campaigns c
    WHERE c.workspace_id = w.id
  ) AS campaign_count,
  (
    SELECT count(*)::bigint
    FROM public.enrichment_jobs ej
    WHERE ej.workspace_id = w.id
  ) AS enrichment_job_count,
  (
    SELECT max(sal."timestamp")
    FROM public.system_audit_logs sal
    WHERE sal.workspace_id = w.id
  ) AS last_activity_at,
  w.created_at
FROM public.workspaces w
LEFT JOIN auth.users au ON au.id = w.owner_id
WHERE public.is_system_admin(auth.uid());
CREATE OR REPLACE VIEW public.admin_credit_history_view AS
SELECT
  cu.id,
  cu.workspace_id,
  w.name AS workspace_name,
  w.owner_id,
  au.email AS owner_email,
  cu.action_type,
  cu.amount,
  cu.created_at,
  NULL::jsonb AS metadata
FROM public.credits_usage cu
JOIN public.workspaces w ON w.id = cu.workspace_id
LEFT JOIN auth.users au ON au.id = w.owner_id
WHERE public.is_system_admin(auth.uid());
REVOKE ALL ON public.admin_user_activity_view FROM PUBLIC;
REVOKE ALL ON public.admin_workspace_activity_view FROM PUBLIC;
REVOKE ALL ON public.admin_credit_history_view FROM PUBLIC;
GRANT SELECT ON public.admin_user_activity_view TO authenticated, service_role;
GRANT SELECT ON public.admin_workspace_activity_view TO authenticated, service_role;
GRANT SELECT ON public.admin_credit_history_view TO authenticated, service_role;
CREATE TABLE IF NOT EXISTS public.system_restore_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  snapshot_description text NOT NULL,
  snapshot_metadata jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS public.system_restore_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restore_point_id uuid NOT NULL REFERENCES public.system_restore_points(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  confirmation_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_system_restore_points_created_at ON public.system_restore_points(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_restore_confirmations_lookup ON public.system_restore_confirmations(restore_point_id, requested_by, used_at);
ALTER TABLE public.system_restore_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_restore_confirmations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_restore_points_select_admin ON public.system_restore_points;
CREATE POLICY system_restore_points_select_admin ON public.system_restore_points
  FOR SELECT USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS system_restore_confirmations_select_admin ON public.system_restore_confirmations;
CREATE POLICY system_restore_confirmations_select_admin ON public.system_restore_confirmations
  FOR SELECT USING (public.is_system_admin(auth.uid()));
CREATE OR REPLACE FUNCTION public.prevent_restore_point_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Restore points are immutable and cannot be deleted directly';
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_restore_point_delete ON public.system_restore_points;
CREATE TRIGGER trg_prevent_restore_point_delete
  BEFORE DELETE ON public.system_restore_points
  FOR EACH ROW EXECUTE FUNCTION public.prevent_restore_point_delete();
CREATE OR REPLACE FUNCTION public.create_restore_point(
  p_snapshot_description text,
  p_snapshot_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_snapshot jsonb;
  v_id uuid;
BEGIN
  v_actor := auth.uid();
  IF NOT public.is_system_admin(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_snapshot := jsonb_build_object(
    'user_accounts', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'email', au.email,
        'full_name', p.full_name,
        'avatar_url', p.avatar_url,
        'role', ur.role
      )), '[]'::jsonb)
      FROM public.profiles p
      LEFT JOIN auth.users au ON au.id = p.id
      LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    ),
    'workspaces', (
      SELECT coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
      FROM public.workspaces w
    ),
    'workspace_members', (
      SELECT coalesce(jsonb_agg(to_jsonb(wm)), '[]'::jsonb)
      FROM public.workspace_members wm
    ),
    'campaigns', (
      SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
      FROM public.campaigns c
    ),
    'enrichment_jobs', (
      SELECT coalesce(jsonb_agg(to_jsonb(ej)), '[]'::jsonb)
      FROM public.enrichment_jobs ej
    ),
    'subscriptions', (
      SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
      FROM public.subscriptions s
    ),
    'system_settings', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('workspace_id', w.id, 'settings', w.settings)), '[]'::jsonb)
      FROM public.workspaces w
    )
  );

  INSERT INTO public.system_restore_points (
    created_by,
    snapshot_description,
    snapshot_metadata
  ) VALUES (
    v_actor,
    p_snapshot_description,
    v_snapshot || coalesce(p_snapshot_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  PERFORM public.append_system_audit_log(
    v_actor,
    NULL,
    NULL,
    'admin:restore_point:create',
    'System restore point created',
    NULL,
    NULL,
    jsonb_build_object('restore_point_id', v_id, 'description', p_snapshot_description)
  );

  RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.list_restore_points(p_limit int DEFAULT 50)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  created_by uuid,
  snapshot_description text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  IF NOT public.is_system_admin(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT rp.id, rp.created_at, rp.created_by, rp.snapshot_description
    FROM public.system_restore_points rp
    ORDER BY rp.created_at DESC
    LIMIT greatest(1, least(p_limit, 200));
END;
$$;
CREATE OR REPLACE FUNCTION public.request_restore_confirmation(
  p_restore_point_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_token text;
BEGIN
  v_actor := auth.uid();
  IF NOT public.is_system_admin(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.system_restore_points WHERE id = p_restore_point_id) THEN
    RAISE EXCEPTION 'restore_point_not_found' USING ERRCODE = 'P0001';
  END IF;

  v_token := encode(gen_random_bytes(16), 'hex');

  INSERT INTO public.system_restore_confirmations (
    restore_point_id,
    requested_by,
    confirmation_token,
    expires_at
  ) VALUES (
    p_restore_point_id,
    v_actor,
    v_token,
    now() + interval '10 minutes'
  );

  PERFORM public.append_system_audit_log(
    v_actor,
    NULL,
    NULL,
    'admin:restore:confirmation_requested',
    'Restore confirmation token generated',
    NULL,
    NULL,
    jsonb_build_object('restore_point_id', p_restore_point_id)
  );

  RETURN v_token;
END;
$$;
CREATE OR REPLACE FUNCTION public.restore_from_snapshot(
  p_restore_point_id uuid,
  p_confirmation_token text,
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
  v_snapshot jsonb;
  v_confirmation_id uuid;
  v_summary jsonb;
BEGIN
  v_actor := auth.uid();
  IF NOT public.is_system_admin(v_actor) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT rc.id
  INTO v_confirmation_id
  FROM public.system_restore_confirmations rc
  WHERE rc.restore_point_id = p_restore_point_id
    AND rc.requested_by = v_actor
    AND rc.confirmation_token = p_confirmation_token
    AND rc.used_at IS NULL
    AND rc.expires_at > now()
  ORDER BY rc.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_confirmation_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_confirmation' USING ERRCODE = 'P0001';
  END IF;

  SELECT rp.snapshot_metadata
  INTO v_snapshot
  FROM public.system_restore_points rp
  WHERE rp.id = p_restore_point_id
  FOR UPDATE;

  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'restore_point_not_found' USING ERRCODE = 'P0001';
  END IF;

  v_summary := jsonb_build_object(
    'user_accounts', coalesce(jsonb_array_length(v_snapshot->'user_accounts'), 0),
    'workspaces', coalesce(jsonb_array_length(v_snapshot->'workspaces'), 0),
    'workspace_members', coalesce(jsonb_array_length(v_snapshot->'workspace_members'), 0),
    'campaigns', coalesce(jsonb_array_length(v_snapshot->'campaigns'), 0),
    'enrichment_jobs', coalesce(jsonb_array_length(v_snapshot->'enrichment_jobs'), 0),
    'subscriptions', coalesce(jsonb_array_length(v_snapshot->'subscriptions'), 0)
  );

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'restore_point_id', p_restore_point_id,
      'summary', v_summary,
      'confirmation_required', false
    );
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  SELECT x.id, x.email, x.full_name, x.avatar_url
  FROM jsonb_to_recordset(coalesce(v_snapshot->'user_accounts', '[]'::jsonb)) AS x(
    id uuid,
    email text,
    full_name text,
    avatar_url text,
    role public.app_role
  )
  ON CONFLICT (id)
  DO UPDATE SET
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url;

  INSERT INTO public.user_roles (user_id, role)
  SELECT x.id, coalesce(x.role, 'user'::public.app_role)
  FROM jsonb_to_recordset(coalesce(v_snapshot->'user_accounts', '[]'::jsonb)) AS x(
    id uuid,
    email text,
    full_name text,
    avatar_url text,
    role public.app_role
  )
  ON CONFLICT (user_id)
  DO UPDATE SET role = excluded.role;

  INSERT INTO public.workspaces (
    id,
    owner_id,
    name,
    plan,
    search_credits_remaining,
    ai_credits_remaining,
    email_sends_remaining,
    enrichment_credits_remaining,
    credits_reset_at,
    settings,
    created_at
  )
  SELECT
    x.id,
    x.owner_id,
    x.name,
    x.plan,
    x.search_credits_remaining,
    x.ai_credits_remaining,
    x.email_sends_remaining,
    x.enrichment_credits_remaining,
    x.credits_reset_at,
    x.settings,
    x.created_at
  FROM jsonb_to_recordset(coalesce(v_snapshot->'workspaces', '[]'::jsonb)) AS x(
    id uuid,
    owner_id uuid,
    name text,
    plan text,
    search_credits_remaining int,
    ai_credits_remaining int,
    email_sends_remaining int,
    enrichment_credits_remaining int,
    credits_reset_at timestamptz,
    settings jsonb,
    created_at timestamptz
  )
  ON CONFLICT (id)
  DO UPDATE SET
    owner_id = excluded.owner_id,
    name = excluded.name,
    plan = excluded.plan,
    search_credits_remaining = excluded.search_credits_remaining,
    ai_credits_remaining = excluded.ai_credits_remaining,
    email_sends_remaining = excluded.email_sends_remaining,
    enrichment_credits_remaining = excluded.enrichment_credits_remaining,
    credits_reset_at = excluded.credits_reset_at,
    settings = excluded.settings;

  INSERT INTO public.workspace_members (id, workspace_id, user_id, role, created_at)
  SELECT x.id, x.workspace_id, x.user_id, x.role, x.created_at
  FROM jsonb_to_recordset(coalesce(v_snapshot->'workspace_members', '[]'::jsonb)) AS x(
    id uuid,
    workspace_id uuid,
    user_id uuid,
    role public.workspace_role,
    created_at timestamptz
  )
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = excluded.role;

  INSERT INTO public.campaigns (
    id,
    workspace_id,
    name,
    description,
    status,
    budget,
    start_date,
    end_date,
    created_at,
    updated_at
  )
  SELECT
    x.id,
    x.workspace_id,
    x.name,
    x.description,
    x.status,
    x.budget,
    x.start_date,
    x.end_date,
    x.created_at,
    x.updated_at
  FROM jsonb_to_recordset(coalesce(v_snapshot->'campaigns', '[]'::jsonb)) AS x(
    id uuid,
    workspace_id uuid,
    name text,
    description text,
    status public.campaign_status,
    budget numeric,
    start_date date,
    end_date date,
    created_at timestamptz,
    updated_at timestamptz
  )
  ON CONFLICT (id)
  DO UPDATE SET
    workspace_id = excluded.workspace_id,
    name = excluded.name,
    description = excluded.description,
    status = excluded.status,
    budget = excluded.budget,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    updated_at = excluded.updated_at;

  INSERT INTO public.enrichment_jobs (
    id,
    workspace_id,
    platform,
    username,
    primary_niche,
    status,
    attempt_count,
    max_attempts,
    last_error,
    result,
    created_at,
    updated_at,
    next_attempt_at
  )
  SELECT
    x.id,
    x.workspace_id,
    x.platform,
    x.username,
    x.primary_niche,
    x.status,
    x.attempt_count,
    x.max_attempts,
    x.last_error,
    x.result,
    x.created_at,
    x.updated_at,
    x.next_attempt_at
  FROM jsonb_to_recordset(coalesce(v_snapshot->'enrichment_jobs', '[]'::jsonb)) AS x(
    id uuid,
    workspace_id uuid,
    platform text,
    username text,
    primary_niche text,
    status text,
    attempt_count int,
    max_attempts int,
    last_error text,
    result jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    next_attempt_at timestamptz
  )
  ON CONFLICT (id)
  DO UPDATE SET
    status = excluded.status,
    attempt_count = excluded.attempt_count,
    max_attempts = excluded.max_attempts,
    last_error = excluded.last_error,
    result = excluded.result,
    updated_at = excluded.updated_at,
    next_attempt_at = excluded.next_attempt_at;

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
    updated_at
  )
  SELECT
    x.id,
    x.workspace_id,
    x.plan,
    x.status,
    coalesce(nullif(x.stripe_customer_id, ''), 'restored-' || x.workspace_id::text),
    x.stripe_subscription_id,
    x.current_period_start,
    x.current_period_end,
    x.cancel_at_period_end,
    x.created_at,
    x.updated_at
  FROM jsonb_to_recordset(coalesce(v_snapshot->'subscriptions', '[]'::jsonb)) AS x(
    id uuid,
    workspace_id uuid,
    plan text,
    status text,
    stripe_customer_id text,
    stripe_subscription_id text,
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean,
    created_at timestamptz,
    updated_at timestamptz
  )
  ON CONFLICT (workspace_id)
  DO UPDATE SET
    plan = excluded.plan,
    status = excluded.status,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = excluded.updated_at;

  UPDATE public.system_restore_confirmations
  SET used_at = now()
  WHERE id = v_confirmation_id;

  PERFORM public.append_system_audit_log(
    v_actor,
    NULL,
    NULL,
    'admin:restore:executed',
    'Restore operation executed from snapshot',
    NULL,
    NULL,
    jsonb_build_object(
      'restore_point_id', p_restore_point_id,
      'reason', p_reason,
      'summary', v_summary
    )
  );

  RETURN jsonb_build_object(
    'dry_run', false,
    'restore_point_id', p_restore_point_id,
    'summary', v_summary,
    'status', 'restored'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.append_system_audit_log(uuid, uuid, uuid, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_restore_point(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_restore_points(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_restore_confirmation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_from_snapshot(uuid, text, text, boolean) TO authenticated, service_role;
