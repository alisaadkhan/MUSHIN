-- Phase 3: Content & Brand Alignment Schema

CREATE TABLE public.brand_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  category TEXT,
  post_id TEXT,
  mentioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_mentions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read brand mentions" ON public.brand_mentions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage brand mentions" ON public.brand_mentions FOR ALL TO service_role USING (true);

-- Indexes for fast timeline queries
CREATE INDEX idx_brand_mentions_influencer ON public.brand_mentions(influencer_id, mentioned_at DESC);
