-- Phase 2 Feature Migrations

-- 1. Add vector extension if not present, embedding column, and HNSW index
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

ALTER TABLE public.influencer_profiles ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create HNSW index for efficient similarity search
CREATE INDEX IF NOT EXISTS influencer_profiles_embedding_idx 
ON public.influencer_profiles USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 2. Create/update match_influencers RPC
DROP FUNCTION IF EXISTS public.match_influencers;
CREATE OR REPLACE FUNCTION public.match_influencers(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_platform text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  username text,
  platform text,
  full_name text,
  primary_niche text,
  profile_pic_url text,
  follower_count bigint,
  engagement_rate numeric,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ip.id,
    ip.username,
    ip.platform,
    ip.full_name,
    ip.primary_niche,
    ip.profile_pic_url,
    ip.follower_count,
    ip.engagement_rate,
    1 - (ip.embedding <=> query_embedding) AS similarity
  FROM public.influencer_profiles ip
  WHERE 1 - (ip.embedding <=> query_embedding) > match_threshold
    AND (filter_platform IS NULL OR ip.platform = filter_platform)
  ORDER BY ip.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3. Normalized Engagement Score for cross-platform comparison
ALTER TABLE public.influencer_profiles ADD COLUMN IF NOT EXISTS normalized_engagement_score numeric(5,2);

CREATE OR REPLACE FUNCTION public.compute_normalized_engagement(
  platform_name text,
  eng_rate numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  norm numeric;
BEGIN
  -- Simple heuristic baseline comparisons
  -- Instagram ~1.5-3%, TikTok ~3-6%, YouTube ~2-4%
  IF platform_name = 'tiktok' THEN
    norm := eng_rate / 4.0; 
  ELSIF platform_name = 'instagram' THEN
    norm := eng_rate / 2.0;
  ELSIF platform_name = 'youtube' THEN
    norm := eng_rate / 3.0;
  ELSE
    norm := eng_rate / 2.0;
  END IF;
  
  -- Scale to 0-100 range, cap at 100
  RETURN LEAST(ROUND(norm * 50, 2), 100.00);
END;
$$;

-- Update trigger to auto-calculate normalized engagement on insert/update
CREATE OR REPLACE FUNCTION public.trg_update_normalized_engagement()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.engagement_rate IS NOT NULL THEN
    NEW.normalized_engagement_score := public.compute_normalized_engagement(NEW.platform, NEW.engagement_rate);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_norm_eng ON public.influencer_profiles;
CREATE TRIGGER trg_calc_norm_eng
  BEFORE INSERT OR UPDATE OF engagement_rate
  ON public.influencer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_update_normalized_engagement();

-- Retroactively compute for existing profiles
UPDATE public.influencer_profiles 
SET normalized_engagement_score = public.compute_normalized_engagement(platform, engagement_rate)
WHERE engagement_rate IS NOT NULL AND normalized_engagement_score IS NULL;

-- 4. Enable pg_cron and schedule the maintenance jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- Ensure required configurations exist, falling back to dummy values if not set to prevent errors
DO $$
BEGIN
  -- Delete old schedules if they exist
  SELECT cron.unschedule('refresh-stale-profiles');
  SELECT cron.unschedule('process-enrichments');
  SELECT cron.unschedule('monthly-credit-reset');
EXCEPTION WHEN OTHERS THEN
  -- Ignore if cron isn't setup properly yet
END $$;

-- Notice: the user must manually set app.supabase_functions_url and app.service_role_key in Supabase Dashboard
-- Example cron definition, though running edge functions requires pg_net
DO $$
BEGIN
  PERFORM cron.schedule(
    'refresh-stale-profiles',
    '0 3 * * *', -- Every day at 3 AM
    $cron$
    SELECT net.http_post(
        url:=(current_setting('app.supabase_functions_url') || '/refresh-stale-profiles')::text,
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        )
    )
    $cron$
  );

  PERFORM cron.schedule(
    'process-enrichments',
    '* * * * *', -- Every minute
    $cron$
    SELECT net.http_post(
        url:=(current_setting('app.supabase_functions_url') || '/process-enrichment-job')::text,
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        )
    )
    $cron$
  );

  PERFORM cron.schedule(
    'monthly-credit-reset',
    '0 0 1 * *', -- 1st of every month
    $cron$
    SELECT net.http_post(
        url:=(current_setting('app.supabase_functions_url') || '/reset-free-credits')::text,
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        )
    )
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  -- Ensure migration doesn't fail catastrophically if current_settings are missing
  RAISE NOTICE 'Skipping cron schedule creation; ensure app.supabase_functions_url is set.';
END $$;
