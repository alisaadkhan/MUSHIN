
CREATE TABLE public.outreach_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES pipeline_cards(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  platform TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'contacted',
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view outreach logs"
  ON public.outreach_log FOR SELECT
  USING (is_workspace_member(
    (SELECT workspace_id FROM campaigns WHERE id = campaign_id)
  ));

CREATE POLICY "Members can create outreach logs"
  ON public.outreach_log FOR INSERT
  WITH CHECK (is_workspace_member(
    (SELECT workspace_id FROM campaigns WHERE id = campaign_id)
  ));

CREATE POLICY "Members can update outreach logs"
  ON public.outreach_log FOR UPDATE
  USING (is_workspace_member(
    (SELECT workspace_id FROM campaigns WHERE id = campaign_id)
  ));

CREATE INDEX idx_outreach_log_campaign ON public.outreach_log(campaign_id);
CREATE INDEX idx_outreach_log_card ON public.outreach_log(card_id);
