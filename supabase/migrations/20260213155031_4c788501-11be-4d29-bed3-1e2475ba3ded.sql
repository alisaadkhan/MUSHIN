
CREATE TABLE public.campaign_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view campaign activity"
  ON public.campaign_activity FOR SELECT
  USING (is_workspace_member(
    (SELECT workspace_id FROM campaigns WHERE id = campaign_activity.campaign_id)
  ));

CREATE POLICY "Members can log campaign activity"
  ON public.campaign_activity FOR INSERT
  WITH CHECK (is_workspace_member(
    (SELECT workspace_id FROM campaigns WHERE id = campaign_activity.campaign_id)
  ));

CREATE INDEX idx_campaign_activity_campaign
  ON public.campaign_activity(campaign_id, created_at DESC);
