-- Production Readiness Guards
-- Adds security monitoring, telemetry metrics, and billing integrity protections.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  event_type text NOT NULL,
  risk_score integer NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS "timestamp" timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS risk_score integer;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_security_events_ts ON public.security_events("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_risk ON public.security_events(risk_score DESC);
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS security_events_select_admin ON public.security_events;
CREATE POLICY security_events_select_admin ON public.security_events
  FOR SELECT USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS security_events_insert_service_role ON public.security_events;
CREATE POLICY security_events_insert_service_role ON public.security_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  tags jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.system_metrics ADD COLUMN IF NOT EXISTS "timestamp" timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.system_metrics ADD COLUMN IF NOT EXISTS metric_name text;
ALTER TABLE public.system_metrics ADD COLUMN IF NOT EXISTS metric_value numeric;
ALTER TABLE public.system_metrics ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_system_metrics_ts ON public.system_metrics("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_ts ON public.system_metrics(metric_name, "timestamp" DESC);
CREATE TABLE IF NOT EXISTS public.api_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  duration_ms integer NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.api_usage_metrics ADD COLUMN IF NOT EXISTS "timestamp" timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.api_usage_metrics ADD COLUMN IF NOT EXISTS endpoint text;
ALTER TABLE public.api_usage_metrics ADD COLUMN IF NOT EXISTS method text;
ALTER TABLE public.api_usage_metrics ADD COLUMN IF NOT EXISTS status_code integer;
ALTER TABLE public.api_usage_metrics ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE public.api_usage_metrics ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.api_usage_metrics ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.api_usage_metrics ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.api_usage_metrics ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_api_usage_metrics_ts ON public.api_usage_metrics("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_metrics_endpoint_ts ON public.api_usage_metrics(endpoint, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_metrics_status_ts ON public.api_usage_metrics(status_code, "timestamp" DESC);
CREATE TABLE IF NOT EXISTS public.credit_consumption_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  credit_type text NOT NULL,
  amount_before integer NOT NULL,
  amount_after integer NOT NULL,
  delta integer NOT NULL,
  action_source text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.credit_consumption_metrics ADD COLUMN IF NOT EXISTS "timestamp" timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.credit_consumption_metrics ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.credit_consumption_metrics ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.credit_consumption_metrics ADD COLUMN IF NOT EXISTS credit_type text;
ALTER TABLE public.credit_consumption_metrics ADD COLUMN IF NOT EXISTS amount_before integer;
ALTER TABLE public.credit_consumption_metrics ADD COLUMN IF NOT EXISTS amount_after integer;
ALTER TABLE public.credit_consumption_metrics ADD COLUMN IF NOT EXISTS delta integer;
ALTER TABLE public.credit_consumption_metrics ADD COLUMN IF NOT EXISTS action_source text;
ALTER TABLE public.credit_consumption_metrics ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_credit_consumption_metrics_ts ON public.credit_consumption_metrics("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_credit_consumption_metrics_ws_ts ON public.credit_consumption_metrics(workspace_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_credit_consumption_metrics_type_ts ON public.credit_consumption_metrics(credit_type, "timestamp" DESC);
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_consumption_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_metrics_select_admin ON public.system_metrics;
CREATE POLICY system_metrics_select_admin ON public.system_metrics
  FOR SELECT USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS api_usage_metrics_select_admin ON public.api_usage_metrics;
CREATE POLICY api_usage_metrics_select_admin ON public.api_usage_metrics
  FOR SELECT USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS credit_consumption_metrics_select_admin ON public.credit_consumption_metrics;
CREATE POLICY credit_consumption_metrics_select_admin ON public.credit_consumption_metrics
  FOR SELECT USING (public.is_system_admin(auth.uid()));
DROP POLICY IF EXISTS telemetry_insert_service_role_system_metrics ON public.system_metrics;
CREATE POLICY telemetry_insert_service_role_system_metrics ON public.system_metrics
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS telemetry_insert_service_role_api_usage ON public.api_usage_metrics;
CREATE POLICY telemetry_insert_service_role_api_usage ON public.api_usage_metrics
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS telemetry_insert_service_role_credit_metrics ON public.credit_consumption_metrics;
CREATE POLICY telemetry_insert_service_role_credit_metrics ON public.credit_consumption_metrics
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
ALTER TABLE public.credits_usage
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_credits_usage_workspace_idempotency
  ON public.credits_usage(workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.record_system_metric(
  p_metric_name text,
  p_metric_value numeric,
  p_tags jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.system_metrics(metric_name, metric_value, tags)
  VALUES (p_metric_name, p_metric_value, coalesce(p_tags, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.record_api_usage_metric(
  p_endpoint text,
  p_method text,
  p_status_code integer,
  p_duration_ms integer,
  p_user_id uuid DEFAULT NULL,
  p_workspace_id uuid DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
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
  INSERT INTO public.api_usage_metrics(
    endpoint,
    method,
    status_code,
    duration_ms,
    user_id,
    workspace_id,
    ip_address,
    metadata
  ) VALUES (
    p_endpoint,
    p_method,
    p_status_code,
    p_duration_ms,
    p_user_id,
    p_workspace_id,
    p_ip_address,
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_mutate_workspace_credit(
  p_workspace_id uuid,
  p_credit_type text,
  p_mode text,
  p_delta integer DEFAULT NULL,
  p_new_balance integer DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_col text;
  v_before integer;
  v_after integer;
  v_effective_delta integer;
  v_existing record;
BEGIN
  IF p_credit_type NOT IN ('search', 'ai', 'email', 'enrichment') THEN
    RAISE EXCEPTION 'invalid_credit_type' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode NOT IN ('adjust', 'set') THEN
    RAISE EXCEPTION 'invalid_mode' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode = 'adjust' AND (p_delta IS NULL OR p_delta = 0) THEN
    RAISE EXCEPTION 'invalid_delta' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode = 'set' AND p_new_balance IS NULL THEN
    RAISE EXCEPTION 'invalid_new_balance' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode = 'set' AND p_new_balance < 0 THEN
    RAISE EXCEPTION 'negative_balance_not_allowed' USING ERRCODE = 'P0001';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT cu.*
    INTO v_existing
    FROM public.credits_usage cu
    WHERE cu.workspace_id = p_workspace_id
      AND cu.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'idempotent_replay', true,
        'workspace_id', p_workspace_id,
        'credit_type', p_credit_type,
        'delta', v_existing.amount
      );
    END IF;
  END IF;

  v_col := CASE p_credit_type
    WHEN 'search' THEN 'search_credits_remaining'
    WHEN 'ai' THEN 'ai_credits_remaining'
    WHEN 'email' THEN 'email_sends_remaining'
    ELSE 'enrichment_credits_remaining'
  END;

  EXECUTE format('SELECT %I FROM public.workspaces WHERE id = $1 FOR UPDATE', v_col)
    INTO v_before
    USING p_workspace_id;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF p_mode = 'set' THEN
    v_after := greatest(0, p_new_balance);
    v_effective_delta := v_after - v_before;
  ELSE
    v_after := greatest(0, v_before + p_delta);
    v_effective_delta := v_after - v_before;
  END IF;

  EXECUTE format('UPDATE public.workspaces SET %I = $1 WHERE id = $2', v_col)
    USING v_after, p_workspace_id;

  INSERT INTO public.credits_usage(
    workspace_id,
    action_type,
    amount,
    reference_id,
    idempotency_key
  ) VALUES (
    p_workspace_id,
    'admin_' || p_credit_type || '_' || p_mode,
    v_effective_delta,
    NULL,
    p_idempotency_key
  );

  INSERT INTO public.credit_consumption_metrics(
    workspace_id,
    user_id,
    credit_type,
    amount_before,
    amount_after,
    delta,
    action_source,
    metadata
  ) VALUES (
    p_workspace_id,
    p_actor_user_id,
    p_credit_type,
    v_before,
    v_after,
    v_effective_delta,
    'admin_control_plane',
    jsonb_build_object(
      'reason', p_reason,
      'mode', p_mode,
      'target_user_id', p_target_user_id
    )
  );

  PERFORM public.append_system_audit_log(
    p_actor_user_id,
    p_target_user_id,
    p_workspace_id,
    'admin:credits:' || p_mode,
    'Workspace credits mutated via admin control plane',
    p_ip_address,
    p_user_agent,
    jsonb_build_object(
      'credit_type', p_credit_type,
      'before', v_before,
      'after', v_after,
      'delta', v_effective_delta,
      'reason', p_reason,
      'idempotency_key', p_idempotency_key
    )
  );

  RETURN jsonb_build_object(
    'idempotent_replay', false,
    'workspace_id', p_workspace_id,
    'credit_type', p_credit_type,
    'before', v_before,
    'after', v_after,
    'delta', v_effective_delta
  );
END;
$$;
CREATE OR REPLACE VIEW public.dashboard_requests_per_minute AS
SELECT
  date_trunc('minute', aum."timestamp") AS bucket,
  aum.endpoint,
  count(*)::bigint AS requests
FROM public.api_usage_metrics aum
GROUP BY 1, 2;
CREATE OR REPLACE VIEW public.dashboard_error_rates AS
SELECT
  date_trunc('minute', aum."timestamp") AS bucket,
  aum.endpoint,
  count(*) FILTER (WHERE aum.status_code >= 500)::bigint AS server_errors,
  count(*) FILTER (WHERE aum.status_code >= 400 AND aum.status_code < 500)::bigint AS client_errors,
  count(*)::bigint AS total_requests,
  CASE WHEN count(*) = 0 THEN 0
       ELSE round((count(*) FILTER (WHERE aum.status_code >= 500)::numeric / count(*)::numeric) * 100, 2)
  END AS server_error_rate_pct
FROM public.api_usage_metrics aum
GROUP BY 1, 2;
CREATE OR REPLACE VIEW public.dashboard_credit_burn_rate AS
SELECT
  date_trunc('hour', ccm."timestamp") AS bucket,
  ccm.workspace_id,
  ccm.credit_type,
  sum(abs(ccm.delta))::bigint AS credits_burned
FROM public.credit_consumption_metrics ccm
GROUP BY 1, 2, 3;
CREATE OR REPLACE VIEW public.dashboard_job_queue_sizes AS
SELECT
  date_trunc('minute', now()) AS bucket,
  ej.status,
  count(*)::bigint AS queue_size
FROM public.enrichment_jobs ej
GROUP BY ej.status;
REVOKE ALL ON public.dashboard_requests_per_minute FROM PUBLIC;
REVOKE ALL ON public.dashboard_error_rates FROM PUBLIC;
REVOKE ALL ON public.dashboard_credit_burn_rate FROM PUBLIC;
REVOKE ALL ON public.dashboard_job_queue_sizes FROM PUBLIC;
GRANT SELECT ON public.dashboard_requests_per_minute TO authenticated, service_role;
GRANT SELECT ON public.dashboard_error_rates TO authenticated, service_role;
GRANT SELECT ON public.dashboard_credit_burn_rate TO authenticated, service_role;
GRANT SELECT ON public.dashboard_job_queue_sizes TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_system_metric(text, numeric, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_api_usage_metric(text, text, integer, integer, uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_mutate_workspace_credit(uuid, text, text, integer, integer, text, uuid, uuid, text, text, text) TO service_role;
