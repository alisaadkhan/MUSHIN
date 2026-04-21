-- ============================================================
-- MUSHIN — Remove "free plan" default
-- Migration: 20260421070000_remove_free_plan_default.sql
--
-- We don't market/sell a free plan. Existing "free" workspaces should be
-- upgraded to "pro" for UI consistency; credits remain ledger-based (0 unless granted).
-- ============================================================

-- New signups should default to pro instead of free.
ALTER TABLE public.workspaces
  ALTER COLUMN plan SET DEFAULT 'pro';

-- Normalize existing workspaces that still say "free"
UPDATE public.workspaces
SET plan = 'pro'
WHERE plan = 'free';

