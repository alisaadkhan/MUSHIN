ALTER TABLE public.influencer_profiles ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending';
