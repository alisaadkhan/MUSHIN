-- ============================================================
-- MUSHIN — Admin/Support can read Paddle subscriptions (RLS)
-- Migration: 20260421080000_admin_read_paddle_subscriptions.sql
-- ============================================================

ALTER TABLE public.paddle_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_support_read_paddle_subscriptions ON public.paddle_subscriptions;
CREATE POLICY admin_support_read_paddle_subscriptions ON public.paddle_subscriptions
  FOR SELECT
  USING (public.is_support_or_admin() OR public.is_system_admin(auth.uid()));

