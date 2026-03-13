-- Fix consume_search_credit: wrong column name was causing credits to never deduct
CREATE OR REPLACE FUNCTION consume_search_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE workspaces
  SET search_credits_remaining = search_credits_remaining - 1
  WHERE id = ws_id
    AND search_credits_remaining > 0;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
-- Idempotency keys table — prevents double-billing on retried requests
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(key, user_id)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user ON public.idempotency_keys(user_id, created_at);
-- Auto-expire after 24h via a cleanup job (see reset-free-credits or a new cron)

-- Enrichment jobs queue table — for async enrichment
CREATE TABLE IF NOT EXISTS public.enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  username text NOT NULL,
  primary_niche text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed','dead')),
  attempt_count int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  last_error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, username, workspace_id)
);
-- Ensure columns exist if table was created in an older iteration
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0;
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 3;
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS result jsonb;
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.enrichment_jobs ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
-- Fix enum issue if the column was created as enrichment_status enum
ALTER TABLE public.enrichment_jobs ALTER COLUMN status TYPE text USING status::text;
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_status ON public.enrichment_jobs(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_workspace ON public.enrichment_jobs(workspace_id);
-- Audience analysis table — for enhanced bot detection results
CREATE TABLE IF NOT EXISTS public.audience_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  bot_score int CHECK (bot_score >= 0 AND bot_score <= 100),
  audience_quality_score int CHECK (audience_quality_score >= 0 AND audience_quality_score <= 100),
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  comment_like_ratio numeric,
  post_frequency_per_day numeric,
  sponsored_ratio numeric,
  follower_growth_rate_per_day numeric,
  engagement_consistency text CHECK (engagement_consistency IN ('consistent','variable','suspicious')),
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);
-- Performance indexes on influencer_profiles
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_platform_username 
  ON public.influencer_profiles(platform, username);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_enrichment_status 
  ON public.influencer_profiles(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_enriched_at 
  ON public.influencer_profiles(enriched_at);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_primary_niche 
  ON public.influencer_profiles(primary_niche);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_follower_count 
  ON public.influencer_profiles(follower_count DESC NULLS LAST);
-- Performance indexes on influencer_posts
CREATE INDEX IF NOT EXISTS idx_influencer_posts_profile_id 
  ON public.influencer_posts(profile_id);
CREATE INDEX IF NOT EXISTS idx_influencer_posts_posted_at 
  ON public.influencer_posts(posted_at DESC);
-- Stale data view — profiles not enriched in 30+ days
CREATE OR REPLACE VIEW public.stale_profiles AS
SELECT id, platform, username, enriched_at, 
  EXTRACT(EPOCH FROM (now() - enriched_at))/86400 AS days_since_enrichment
FROM public.influencer_profiles
WHERE enriched_at IS NOT NULL
  AND enriched_at < now() - INTERVAL '30 days'
  AND enrichment_status = 'success';
-- RLS: ensure users can only see their own workspace data
ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own workspace jobs" ON public.enrichment_jobs
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    )
  );
ALTER TABLE public.audience_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read audience analysis" ON public.audience_analysis
  FOR SELECT USING (true);
-- public read, service role writes

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own idempotency keys" ON public.idempotency_keys
  FOR ALL USING (user_id = auth.uid());
-- Claim enrichment jobs atomically — prevents duplicate processing
CREATE OR REPLACE FUNCTION claim_enrichment_jobs(batch_size int DEFAULT 3)
RETURNS SETOF public.enrichment_jobs
LANGUAGE sql
AS $$
  UPDATE public.enrichment_jobs
  SET status = 'processing', attempt_count = attempt_count + 1, updated_at = now()
  WHERE id IN (
    SELECT id FROM public.enrichment_jobs
    WHERE status IN ('queued')
      AND next_attempt_at <= now()
    ORDER BY created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
