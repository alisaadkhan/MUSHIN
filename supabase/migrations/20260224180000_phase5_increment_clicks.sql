-- Adding atomic increment function for tracking metrics

CREATE OR REPLACE FUNCTION increment_click_metric(link_id uuid, metric_date date, influencer_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.campaign_metrics (tracking_link_id, influencer_id, date, clicks)
  VALUES (link_id, influencer_uuid, metric_date, 1)
  ON CONFLICT (tracking_link_id, date)
  DO UPDATE SET clicks = public.campaign_metrics.clicks + 1;
END;
$$;
