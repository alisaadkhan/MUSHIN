-- ============================================================
-- MUSHIN — Support can read system audit logs (read-only)
-- Migration: 20260421051000_system_audit_support_read.sql
-- ============================================================

ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_audit_logs_select_support_admin ON public.system_audit_logs;
CREATE POLICY system_audit_logs_select_support_admin ON public.system_audit_logs
  FOR SELECT
  USING (public.is_support_or_admin() OR public.is_system_admin(auth.uid()));

-- Keep immutability + service_role insert-only as defined previously.

