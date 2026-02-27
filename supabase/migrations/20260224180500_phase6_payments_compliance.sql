-- Phase 6: Payment & Compliance Schema

CREATE TABLE public.tax_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL, -- Supabase Storage URL
  status TEXT NOT NULL DEFAULT 'pending', -- pending, verified, rejected
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);
ALTER TABLE public.tax_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Influencers can manage own tax documents" ON public.tax_documents FOR ALL TO authenticated USING (
   -- Assuming profile ID might be linked to auth user if they claim it, or managed by workspace 
   -- Here we'll default to workspace management for B2B platform
   influencer_id IN (SELECT id FROM influencer_profiles)
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  stripe_transfer_id TEXT,
  invoice_url TEXT, -- Link to generated PDF
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspaces can view their payments" ON public.payments FOR SELECT TO authenticated USING (
    workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);
CREATE POLICY "Service roles can manage payments" ON public.payments FOR ALL TO service_role USING (true);

-- Indexes
CREATE INDEX idx_payments_workspace ON public.payments(workspace_id);
CREATE INDEX idx_payments_influencer ON public.payments(influencer_id);
CREATE INDEX idx_tax_docs_influencer ON public.tax_documents(influencer_id);
