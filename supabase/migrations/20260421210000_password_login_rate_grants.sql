-- Idempotent grants so PostgREST + service_role can call the rate-limit RPC reliably.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'password_login_rate_consume'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.password_login_rate_consume(text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.password_login_rate_consume(text) TO postgres;
  END IF;
END $$;
