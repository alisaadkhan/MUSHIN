-- Password-based auth rate limiting: max 5 attempts per IP per 15-minute window.
-- Used by edge function auth-password-rate (login, signup password, staff login).

CREATE TABLE IF NOT EXISTS public.auth_password_login_buckets (
  ip text NOT NULL,
  window_bucket bigint NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip, window_bucket)
);
CREATE INDEX IF NOT EXISTS idx_auth_pw_buckets_updated ON public.auth_password_login_buckets (updated_at);
ALTER TABLE public.auth_password_login_buckets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_password_login_buckets_service ON public.auth_password_login_buckets;
CREATE POLICY auth_password_login_buckets_service ON public.auth_password_login_buckets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
-- No direct access from authenticated users
REVOKE ALL ON public.auth_password_login_buckets FROM PUBLIC;
GRANT ALL ON public.auth_password_login_buckets TO service_role;
CREATE OR REPLACE FUNCTION public.password_login_rate_consume(p_ip text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b bigint := floor(extract(epoch from now()) / 900)::bigint;
  v_count integer;
  v_max constant integer := 5;
  v_retry bigint;
  v_now bigint := floor(extract(epoch from now()))::bigint;
BEGIN
  IF p_ip IS NULL OR length(trim(p_ip)) = 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after', 900,
      'remaining', 0,
      'reason', 'missing_ip'
    );
  END IF;

  INSERT INTO public.auth_password_login_buckets AS t (ip, window_bucket, hit_count, updated_at)
  VALUES (trim(p_ip), b, 1, now())
  ON CONFLICT (ip, window_bucket) DO UPDATE
  SET
    hit_count = auth_password_login_buckets.hit_count + 1,
    updated_at = now()
  RETURNING hit_count INTO v_count;

  v_retry := (b + 1) * 900 - v_now;
  IF v_retry < 1 THEN
    v_retry := 1;
  END IF;

  IF v_count > v_max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after', v_retry,
      'remaining', 0,
      'reason', 'rate_limited'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'retry_after', 0,
    'remaining', greatest(0, v_max - v_count)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.password_login_rate_consume(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.password_login_rate_consume(text) TO service_role;
COMMENT ON FUNCTION public.password_login_rate_consume(text) IS
  'Increments per-IP password auth attempts in the current 15m window; allows at most 5.';
