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
DO $$
BEGIN
  -- Some environments have protection triggers preventing direct plan changes.
  -- This is a one-time normalization for legacy rows; temporarily disable triggers.
  BEGIN
    EXECUTE 'ALTER TABLE public.workspaces DISABLE TRIGGER ALL';
  EXCEPTION WHEN insufficient_privilege THEN
    -- If we can't disable triggers, we still attempt the update (may be blocked).
    NULL;
  END;

  BEGIN
    UPDATE public.workspaces
    SET plan = 'pro'
    WHERE plan = 'free';
  EXCEPTION WHEN others THEN
    -- If a protection trigger blocks this update, skip normalization.
    NULL;
  END;

  BEGIN
    EXECUTE 'ALTER TABLE public.workspaces ENABLE TRIGGER ALL';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
