
-- Campaign status enum
CREATE TYPE public.campaign_status AS ENUM ('draft', 'active', 'completed', 'archived');

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  budget NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view campaigns" ON public.campaigns FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY "Members can create campaigns" ON public.campaigns FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "Members can update campaigns" ON public.campaigns FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY "Members can delete campaigns" ON public.campaigns FOR DELETE USING (is_workspace_member(workspace_id));

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Pipeline stages table
CREATE TABLE public.pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view stages" ON public.pipeline_stages FOR SELECT
  USING (is_workspace_member((SELECT workspace_id FROM public.campaigns WHERE id = pipeline_stages.campaign_id)));
CREATE POLICY "Members can create stages" ON public.pipeline_stages FOR INSERT
  WITH CHECK (is_workspace_member((SELECT workspace_id FROM public.campaigns WHERE id = pipeline_stages.campaign_id)));
CREATE POLICY "Members can update stages" ON public.pipeline_stages FOR UPDATE
  USING (is_workspace_member((SELECT workspace_id FROM public.campaigns WHERE id = pipeline_stages.campaign_id)));
CREATE POLICY "Members can delete stages" ON public.pipeline_stages FOR DELETE
  USING (is_workspace_member((SELECT workspace_id FROM public.campaigns WHERE id = pipeline_stages.campaign_id)));

-- Pipeline cards table
CREATE TABLE public.pipeline_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  platform TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  agreed_rate NUMERIC,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view cards" ON public.pipeline_cards FOR SELECT
  USING (is_workspace_member((SELECT workspace_id FROM public.campaigns WHERE id = pipeline_cards.campaign_id)));
CREATE POLICY "Members can create cards" ON public.pipeline_cards FOR INSERT
  WITH CHECK (is_workspace_member((SELECT workspace_id FROM public.campaigns WHERE id = pipeline_cards.campaign_id)));
CREATE POLICY "Members can update cards" ON public.pipeline_cards FOR UPDATE
  USING (is_workspace_member((SELECT workspace_id FROM public.campaigns WHERE id = pipeline_cards.campaign_id)));
CREATE POLICY "Members can delete cards" ON public.pipeline_cards FOR DELETE
  USING (is_workspace_member((SELECT workspace_id FROM public.campaigns WHERE id = pipeline_cards.campaign_id)));

CREATE TRIGGER update_pipeline_cards_updated_at BEFORE UPDATE ON public.pipeline_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create default stages when a campaign is created
CREATE OR REPLACE FUNCTION public.create_default_pipeline_stages()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.pipeline_stages (campaign_id, name, position, color) VALUES
    (NEW.id, 'Shortlisted', 0, '#6366f1'),
    (NEW.id, 'Contacted', 1, '#f59e0b'),
    (NEW.id, 'Negotiating', 2, '#3b82f6'),
    (NEW.id, 'Confirmed', 3, '#10b981'),
    (NEW.id, 'Completed', 4, '#8b5cf6');
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_campaign_default_stages
  AFTER INSERT ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_pipeline_stages();
