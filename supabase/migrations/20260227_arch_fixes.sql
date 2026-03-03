-- Fix 1: Add Missing enrichment_error Column
ALTER TABLE public.influencer_profiles 
ADD COLUMN IF NOT EXISTS enrichment_error text;

-- Fix 2: Atomic Credit Decrement with Zero-Credit Guard
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

CREATE OR REPLACE FUNCTION consume_enrichment_credit(ws_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE workspaces
  SET enrichment_credits_remaining = enrichment_credits_remaining - 1
  WHERE id = ws_id
    AND enrichment_credits_remaining > 0;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Fix 4: HNSW Index on Correct Table
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.influencers_cache 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_influencers_cache_embedding
ON public.influencers_cache
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- Fix 1: Add Missing Columns
ALTER TABLE public.influencer_profiles 
ADD COLUMN IF NOT EXISTS enrichment_error text;

ALTER TABLE public.influencer_profiles 
ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending';

-- Fix 10: Admin Audit Log (Observability Pipeline)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  user_id uuid NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fix 3: Create match_influencers RPC
CREATE OR REPLACE FUNCTION match_influencers(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 10,
  filter_platform text DEFAULT NULL
) RETURNS TABLE (id uuid, username text, platform text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT id, username, platform,
    1 - (embedding <=> query_embedding) AS similarity
  FROM influencers_cache
  WHERE (filter_platform IS NULL OR platform = filter_platform)
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
