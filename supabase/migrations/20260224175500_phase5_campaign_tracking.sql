-- Phase 5: Campaign Tracking & ROI Schema

CREATE TABLE public.tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  tracking_code TEXT NOT NULL UNIQUE,
  short_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read their campaign tracking links" ON public.tracking_links FOR SELECT TO authenticated USING (
    campaign_id IN (SELECT id FROM campaigns WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
);
CREATE POLICY "Authenticated users can create campaign tracking links" ON public.tracking_links FOR INSERT TO authenticated WITH CHECK (
    campaign_id IN (SELECT id FROM campaigns WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))
);

CREATE TABLE public.campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_link_id UUID NOT NULL REFERENCES public.tracking_links(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue_generated NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tracking_link_id, date)
);
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read metrics for their workspaces" ON public.campaign_metrics FOR SELECT TO authenticated USING (
    tracking_link_id IN (SELECT id FROM tracking_links WHERE campaign_id IN (SELECT id FROM campaigns WHERE workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())))
);
CREATE POLICY "Service roles can manage metrics" ON public.campaign_metrics FOR ALL TO service_role USING (true);

-- Indexes for time series querying
CREATE INDEX idx_campaign_metrics_link_date ON public.campaign_metrics(tracking_link_id, date DESC);
CREATE INDEX idx_tracking_links_code ON public.tracking_links(tracking_code);
