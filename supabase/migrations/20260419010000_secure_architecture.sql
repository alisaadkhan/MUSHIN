-- Migration: Secure Architecture RLS Hardening & Audit
-- Implementation of strict security architecture

-- 1. HARDEN CORE TABLES: Deny by default, explicit select/update where needed
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_secrets ENABLE ROW LEVEL SECURITY;
-- 2. Drop any overly permissive policies on profiles if they existed
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
-- 3. Restrict Profiles strictly to owner (auth.uid() = id)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT
USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
-- 4. Billing/Subscriptions: Service Role only for DML, read-only for tenant's workspace
DROP POLICY IF EXISTS "Subscriptions viewable by workspace" ON public.subscriptions;
CREATE POLICY "Subscriptions viewable by workspace" 
ON public.subscriptions FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "Deny all user updates to subscriptions" ON public.subscriptions;
CREATE POLICY "Deny all user updates to subscriptions" 
ON public.subscriptions FOR UPDATE
USING (false);
DROP POLICY IF EXISTS "Deny all user inserts to subscriptions" ON public.subscriptions;
CREATE POLICY "Deny all user inserts to subscriptions" 
ON public.subscriptions FOR INSERT
WITH CHECK (false);
-- 5. Anomaly Logging Database Table
CREATE TABLE IF NOT EXISTS public.security_anomaly_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address text,
    anomaly_type text NOT NULL,
    description text,
    severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.security_anomaly_logs ENABLE ROW LEVEL SECURITY;
-- Only service role can interact with anomaly logs
DROP POLICY IF EXISTS "Anomaly logs are service role only" ON public.security_anomaly_logs;
CREATE POLICY "Anomaly logs are service role only" 
ON public.security_anomaly_logs FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
-- 6. Trigger to alert on rapid failed auth attempts or weird access speeds (Example logic)
CREATE OR REPLACE FUNCTION notify_security_anomaly() RETURNS TRIGGER AS $$
BEGIN
  -- We would theoretically dispatch a webhook or alert here using pg_net in production
  -- For now, this just exists as a hook for edge functions to listen to via real-time
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trg_security_anomaly_alert ON public.security_anomaly_logs;
CREATE TRIGGER trg_security_anomaly_alert
  AFTER INSERT ON public.security_anomaly_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_security_anomaly();
