-- Phase 2: Data Enrichment Schema

-- 1. Influencer Profiles
CREATE TABLE public.influencer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  full_name TEXT,
  bio TEXT,
  enriched_at TIMESTAMPTZ,
  primary_niche TEXT,
  secondary_niches JSONB DEFAULT '[]'::jsonb,
  brand_safety JSONB DEFAULT '{}'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  overall_score FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(platform, username)
);
ALTER TABLE public.influencer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read profiles" ON public.influencer_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage profiles" ON public.influencer_profiles FOR ALL TO service_role USING (true);

-- The trigger function update_updated_at() was created in the initial migration
CREATE TRIGGER update_influencer_profiles_updated_at 
  BEFORE UPDATE ON public.influencer_profiles 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Influencer Posts
CREATE TABLE public.influencer_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  platform_post_id TEXT NOT NULL,
  caption TEXT,
  image_urls JSONB DEFAULT '[]'::jsonb,
  posted_at TIMESTAMPTZ,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  ai_tags JSONB DEFAULT '[]'::jsonb,
  image_tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, platform_post_id)
);
ALTER TABLE public.influencer_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read posts" ON public.influencer_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage posts" ON public.influencer_posts FOR ALL TO service_role USING (true);
CREATE TRIGGER update_influencer_posts_updated_at 
  BEFORE UPDATE ON public.influencer_posts 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_influencer_posts_profile ON public.influencer_posts(profile_id);

-- 3. Follower History
CREATE TABLE public.follower_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  follower_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.follower_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read follower history" ON public.follower_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage follower history" ON public.follower_history FOR ALL TO service_role USING (true);
CREATE INDEX idx_follower_history_profile_date ON public.follower_history(profile_id, recorded_at DESC);
