
-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view email templates"
  ON public.email_templates FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Members can create email templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "Members can update email templates"
  ON public.email_templates FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "Members can delete email templates"
  ON public.email_templates FOR DELETE
  USING (is_workspace_member(workspace_id));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add email columns to outreach_log
ALTER TABLE public.outreach_log
  ADD COLUMN email_to TEXT,
  ADD COLUMN email_subject TEXT;
