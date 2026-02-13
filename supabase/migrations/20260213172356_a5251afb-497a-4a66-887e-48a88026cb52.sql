-- Phase 8: Compliance additions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ;
ALTER TABLE public.outreach_log ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN DEFAULT false;