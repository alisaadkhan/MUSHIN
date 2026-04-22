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
  SET ai_search_credits_remaining = ai_search_credits_remaining - 1
  WHERE id = ws_id
    AND ai_search_credits_remaining > 0;
  
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
DO $$
BEGIN
  -- Different pgvector versions expose different opclasses and schemas.
  -- Try a few safe variants and skip silently if unsupported.
  BEGIN
    EXECUTE $q$
      CREATE INDEX IF NOT EXISTS idx_influencers_cache_embedding
      ON public.influencers_cache
      USING hnsw (embedding extensions.vector_cosine_ops)
      WITH (m = 16, ef_construction = 128)
    $q$;
  EXCEPTION WHEN undefined_object THEN
    BEGIN
      EXECUTE $q$
        CREATE INDEX IF NOT EXISTS idx_influencers_cache_embedding
        ON public.influencers_cache
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 128)
      $q$;
    EXCEPTION WHEN undefined_object THEN
      -- Skip: HNSW cosine opclass not available in this environment.
      NULL;
    END;
  END;
END;
$$;
-- Fix 10: Admin Audit Log (Observability Pipeline)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  user_id uuid NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
