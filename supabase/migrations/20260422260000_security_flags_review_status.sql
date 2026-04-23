-- ============================================================================
-- Security flags review status (open/reviewed) + severity levels
-- Migration: 20260422260000_security_flags_review_status.sql
--
-- Adds review workflow fields without breaking existing flags.
-- ============================================================================

BEGIN;

ALTER TABLE public.security_flags
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed')),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_reason text;

CREATE INDEX IF NOT EXISTS idx_security_flags_status_time
  ON public.security_flags(status, flagged_at DESC);

COMMIT;

