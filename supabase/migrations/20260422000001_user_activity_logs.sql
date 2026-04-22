-- Create user_activity_logs table
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    action_type VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'success', -- 'success' or 'error'
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR,
    device_info VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- If the table already existed (older schema), ensure required columns exist
ALTER TABLE public.user_activity_logs
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS workspace_id UUID,
    ADD COLUMN IF NOT EXISTS action_type VARCHAR,
    ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'success',
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS ip_address VARCHAR,
    ADD COLUMN IF NOT EXISTS device_info VARCHAR,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
-- Enable RLS
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
-- Users can read their own activity logs (optional; useful for support/debug UI)
CREATE POLICY "Users can view own activity logs"
    ON public.user_activity_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
-- Allow insert of own activity logs (client-side only if ever needed).
-- Most inserts are expected to come from Edge Functions using the service role,
-- which bypasses RLS entirely.
CREATE POLICY "Users can insert own activity logs"
    ON public.user_activity_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
-- Only admins/system_admin/super_admin can view all logs
CREATE POLICY "Admins can view activity logs" 
    ON public.user_activity_logs FOR SELECT 
    TO authenticated 
    USING (
        get_my_role() IN ('admin', 'super_admin', 'system_admin')
    );
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_created_at
    ON public.user_activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_workspace_created_at
    ON public.user_activity_logs(workspace_id, created_at DESC);
