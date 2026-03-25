-- Super Admin and Platform Hardening
-- Adds: global API rate limiting, security alerts, super-admin authority helpers,
-- backup metadata/bucket bootstrap, and super-admin dashboard views.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Super admin helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = coalesce(p_user_id, auth.uid())
      AND ur.role::text = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role, anon;

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
    WHERE ur.user_id = coalesce(p_user_id, auth.uid())
      AND ur.role::text IN ('system_admin', 'super_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_system_admin(uuid) TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION public.set_super_admin_role(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_enable boolean,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous boolean;
  v_now boolean;
BEGIN
  IF NOT public.is_super_admin(p_actor_user_id) THEN
    RAISE EXCEPTION 'forbidden_super_admin_required' USING ERRCODE = 'P0001';
  END IF;

  IF p_actor_user_id = p_target_user_id AND p_enable = false THEN
    RAISE EXCEPTION 'cannot_remove_self_super_admin' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_target_user_id
      AND ur.role::text = 'super_admin'
  ) INTO v_previous;

  IF p_enable THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (p_target_user_id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = p_target_user_id
      AND role::text = 'super_admin';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_target_user_id
      AND ur.role::text = 'super_admin'
  ) INTO v_now;

  PERFORM public.append_system_audit_log(
    p_actor_user_id,
    p_target_user_id,
    NULL,
    CASE WHEN p_enable THEN 'admin:super_admin:grant' ELSE 'admin:super_admin:revoke' END,
    'Super admin role changed via secure gateway',
    NULL,
    NULL,
    jsonb_build_object(
      'previous', v_previous,
      'current', v_now,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'target_user_id', p_target_user_id,
    'previous', v_previous,
    'current', v_now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_super_admin_role(uuid, uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_super_admin_role(uuid, uuid, boolean, text) TO service_role;

CREATE OR REPLACE FUNCTION public.super_admin_unlimited_credits(
  p_user_id uuid DEFAULT auth.uid(),
  p_workspace_id uuid DEFAULT NULL,
  p_credit_type text DEFAULT 'search'
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer := 0;
BEGIN
  IF public.is_super_admin(p_user_id) THEN
    RETURN 9223372036854775807;
  END IF;

  IF p_workspace_id IS NULL THEN
    RETURN 0;
  END IF;

  EXECUTE format(
    'SELECT coalesce(%I, 0) FROM public.workspaces WHERE id = $1',
    CASE p_credit_type
      WHEN 'search' THEN 'search_credits_remaining'
      WHEN 'ai' THEN 'ai_credits_remaining'
      WHEN 'email' THEN 'email_sends_remaining'
      ELSE 'enrichment_credits_remaining'
    END
  ) INTO v_balance USING p_workspace_id;

  RETURN coalesce(v_balance, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_unlimited_credits(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.super_admin_feature_access(
  p_user_id uuid DEFAULT auth.uid(),
  p_feature text DEFAULT 'search'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(p_user_id)
    AND p_feature IN ('search', 'enrichment', 'campaigns', 'automation', 'api_usage', 'analytics');
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_feature_access(uuid, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Global API rate limiting state and RPC
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address text,
  endpoint text NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL,
  backoff_until timestamptz,
  violation_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_rate_limits_actor_present CHECK (user_id IS NOT NULL OR ip_address IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_rate_limits_window
  ON public.api_rate_limits (coalesce(user_id::text, ''), coalesce(ip_address, ''), endpoint, window_start);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_backoff
  ON public.api_rate_limits (backoff_until)
  WHERE backoff_until IS NOT NULL;

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_rate_limits_service_rw ON public.api_rate_limits;
CREATE POLICY api_rate_limits_service_rw ON public.api_rate_limits
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  p_user_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_endpoint text DEFAULT 'global',
  p_is_admin boolean DEFAULT false,
  p_is_super_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_window timestamptz := date_trunc('minute', now());
  v_rec public.api_rate_limits%ROWTYPE;
  v_per_user_limit integer := CASE WHEN p_is_admin THEN 240 ELSE 120 END;
  v_per_ip_limit integer := CASE WHEN p_is_admin THEN 600 ELSE 240 END;
  v_allowed boolean := true;
  v_retry_seconds integer := 0;
  v_effective_limit integer;
BEGIN
  IF p_is_super_admin THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'retry_after', 0,
      'remaining', 999999,
      'reason', 'super_admin_bypass'
    );
  END IF;

  IF p_user_id IS NULL AND (p_ip_address IS NULL OR p_ip_address = '') THEN
    RETURN jsonb_build_object('allowed', false, 'retry_after', 60, 'remaining', 0, 'reason', 'missing_actor');
  END IF;

  -- User dimension
  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.api_rate_limits(user_id, ip_address, endpoint, request_count, window_start, created_at, updated_at)
    VALUES (p_user_id, null, p_endpoint, 1, v_window, v_now, v_now)
    ON CONFLICT (coalesce(user_id::text, ''), coalesce(ip_address, ''), endpoint, window_start)
    DO UPDATE SET
      request_count = public.api_rate_limits.request_count + 1,
      updated_at = excluded.updated_at
    RETURNING * INTO v_rec;

    IF v_rec.backoff_until IS NOT NULL AND v_rec.backoff_until > v_now THEN
      v_allowed := false;
      v_retry_seconds := greatest(1, extract(epoch from (v_rec.backoff_until - v_now))::integer);
    ELSIF v_rec.request_count > v_per_user_limit THEN
      v_allowed := false;
      v_retry_seconds := 60;
      UPDATE public.api_rate_limits
      SET
        violation_count = violation_count + 1,
        backoff_until = v_now + make_interval(secs => least(600, power(2, least(8, violation_count + 1))::integer))
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;
      v_retry_seconds := greatest(1, extract(epoch from (v_rec.backoff_until - v_now))::integer);
    END IF;
  END IF;

  -- IP dimension
  IF v_allowed AND p_ip_address IS NOT NULL AND p_ip_address <> '' THEN
    INSERT INTO public.api_rate_limits(user_id, ip_address, endpoint, request_count, window_start, created_at, updated_at)
    VALUES (null, p_ip_address, p_endpoint, 1, v_window, v_now, v_now)
    ON CONFLICT (coalesce(user_id::text, ''), coalesce(ip_address, ''), endpoint, window_start)
    DO UPDATE SET
      request_count = public.api_rate_limits.request_count + 1,
      updated_at = excluded.updated_at
    RETURNING * INTO v_rec;

    IF v_rec.backoff_until IS NOT NULL AND v_rec.backoff_until > v_now THEN
      v_allowed := false;
      v_retry_seconds := greatest(1, extract(epoch from (v_rec.backoff_until - v_now))::integer);
    ELSIF v_rec.request_count > v_per_ip_limit THEN
      v_allowed := false;
      v_retry_seconds := 60;
      UPDATE public.api_rate_limits
      SET
        violation_count = violation_count + 1,
        backoff_until = v_now + make_interval(secs => least(600, power(2, least(8, violation_count + 1))::integer))
      WHERE id = v_rec.id
      RETURNING * INTO v_rec;
      v_retry_seconds := greatest(1, extract(epoch from (v_rec.backoff_until - v_now))::integer);
    END IF;
  END IF;

  v_effective_limit := least(v_per_user_limit, v_per_ip_limit);

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'retry_after', v_retry_seconds,
    'remaining', greatest(0, v_effective_limit - coalesce(v_rec.request_count, 0)),
    'burst_protection', true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_api_rate_limit(uuid, text, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(uuid, text, text, boolean, boolean) TO service_role;

-- -----------------------------------------------------------------------------
-- Security alerts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  dispatched boolean NOT NULL DEFAULT false,
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_ts ON public.security_alerts("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON public.security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_pending ON public.security_alerts(dispatched, severity, "timestamp" DESC);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_alerts_read_admin ON public.security_alerts;
CREATE POLICY security_alerts_read_admin ON public.security_alerts
  FOR SELECT USING (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS security_alerts_insert_service ON public.security_alerts;
CREATE POLICY security_alerts_insert_service ON public.security_alerts
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS security_alerts_update_service ON public.security_alerts;
CREATE POLICY security_alerts_update_service ON public.security_alerts
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.create_security_alert(
  p_alert_type text,
  p_severity text,
  p_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.security_alerts(alert_type, severity, user_id, metadata)
  VALUES (p_alert_type, p_severity, p_user_id, coalesce(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_security_alert(text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_security_alert(text, text, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.promote_security_events_to_alerts(
  p_lookback_minutes integer DEFAULT 30,
  p_threshold integer DEFAULT 3
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created integer := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT
      coalesce(se.user_id::text, 'anonymous') AS actor_key,
      count(*)::integer AS event_count,
      max(se.risk_score)::integer AS max_risk,
      jsonb_agg(jsonb_build_object('event_type', se.event_type, 'risk_score', se.risk_score, 'timestamp', se."timestamp") ORDER BY se."timestamp" DESC) AS events
    FROM public.security_events se
    WHERE se."timestamp" >= now() - make_interval(mins => p_lookback_minutes)
    GROUP BY 1
    HAVING count(*) >= p_threshold
  LOOP
    INSERT INTO public.security_alerts(alert_type, severity, user_id, metadata)
    VALUES (
      'repeated_security_events',
      CASE
        WHEN rec.max_risk >= 90 THEN 'critical'
        WHEN rec.max_risk >= 75 THEN 'high'
        WHEN rec.max_risk >= 50 THEN 'medium'
        ELSE 'low'
      END,
      NULLIF(rec.actor_key, 'anonymous')::uuid,
      jsonb_build_object(
        'lookback_minutes', p_lookback_minutes,
        'event_count', rec.event_count,
        'max_risk_score', rec.max_risk,
        'events', rec.events
      )
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN v_created;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_security_events_to_alerts(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_security_events_to_alerts(integer, integer) TO service_role;

-- -----------------------------------------------------------------------------
-- Backup metadata and bucket bootstrap
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_path text NOT NULL,
  backup_checksum text,
  encryption_algorithm text NOT NULL DEFAULT 'aes-256-gcm',
  status text NOT NULL CHECK (status IN ('started', 'uploaded', 'verified', 'failed', 'expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_backup_runs_started ON public.system_backup_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_backup_runs_status ON public.system_backup_runs(status, started_at DESC);

ALTER TABLE public.system_backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_backup_runs_read_admin ON public.system_backup_runs;
CREATE POLICY system_backup_runs_read_admin ON public.system_backup_runs
  FOR SELECT USING (public.is_system_admin(auth.uid()));

DROP POLICY IF EXISTS system_backup_runs_service_write ON public.system_backup_runs;
CREATE POLICY system_backup_runs_service_write ON public.system_backup_runs
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO storage.buckets (id, name, public)
VALUES ('system_backups', 'system_backups', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.list_recent_backups(p_limit integer DEFAULT 30)
RETURNS SETOF public.system_backup_runs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.system_backup_runs
  ORDER BY started_at DESC
  LIMIT greatest(1, least(200, p_limit));
$$;

GRANT EXECUTE ON FUNCTION public.list_recent_backups(integer) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Super admin platform views
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.super_admin_user_overview AS
SELECT
  au.id AS user_id,
  au.email,
  p.full_name,
  coalesce(p.created_at, au.created_at) AS profile_created_at,
  coalesce(array_agg(distinct ur.role::text) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::text[]) AS roles,
  count(distinct wm.workspace_id)::bigint AS workspace_count,
  max(se."timestamp") AS last_security_event_at,
  count(distinct se.id)::bigint AS security_event_count
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
LEFT JOIN public.workspace_members wm ON wm.user_id = au.id
LEFT JOIN public.security_events se ON se.user_id = au.id
GROUP BY au.id, au.email, p.full_name, p.created_at, au.created_at;

CREATE OR REPLACE VIEW public.super_admin_workspace_overview AS
SELECT
  w.id AS workspace_id,
  w.name,
  w.plan,
  w.owner_id,
  w.created_at,
  count(distinct wm.user_id)::bigint AS member_count,
  coalesce(w.search_credits_remaining, 0) AS search_credits_remaining,
  coalesce(w.ai_credits_remaining, 0) AS ai_credits_remaining,
  coalesce(w.email_sends_remaining, 0) AS email_sends_remaining,
  coalesce(w.enrichment_credits_remaining, 0) AS enrichment_credits_remaining,
  coalesce(sum(abs(ccm.delta)), 0)::bigint AS total_credit_activity
FROM public.workspaces w
LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
LEFT JOIN public.credit_consumption_metrics ccm ON ccm.workspace_id = w.id
GROUP BY w.id, w.name, w.plan, w.owner_id, w.created_at, w.search_credits_remaining, w.ai_credits_remaining, w.email_sends_remaining, w.enrichment_credits_remaining;

CREATE OR REPLACE VIEW public.super_admin_system_health AS
SELECT
  now() AS observed_at,
  (SELECT count(*)::bigint FROM public.profiles) AS total_users,
  (SELECT count(*)::bigint FROM public.workspaces) AS total_workspaces,
  (SELECT count(*)::bigint FROM public.campaigns WHERE status = 'active') AS active_campaigns,
  (SELECT count(*)::bigint FROM public.security_alerts WHERE dispatched = false AND severity IN ('high', 'critical')) AS pending_high_alerts,
  (SELECT count(*)::bigint FROM public.security_events WHERE "timestamp" >= now() - interval '24 hours') AS security_events_24h,
  (SELECT coalesce(sum(abs(delta)), 0)::bigint FROM public.credit_consumption_metrics WHERE "timestamp" >= now() - interval '24 hours') AS credits_burned_24h,
  (SELECT coalesce(avg(metric_value), 0) FROM public.system_metrics WHERE metric_name = 'security_monitor_events_generated' AND "timestamp" >= now() - interval '24 hours') AS avg_security_events_generated_24h;

GRANT SELECT ON public.super_admin_user_overview TO authenticated, service_role;
GRANT SELECT ON public.super_admin_workspace_overview TO authenticated, service_role;
GRANT SELECT ON public.super_admin_system_health TO authenticated, service_role;
