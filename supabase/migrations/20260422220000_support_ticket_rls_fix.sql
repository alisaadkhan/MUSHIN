-- Fix support ticket RLS for staff/admin (idempotent)
-- A later migration accidentally replaced the robust user_roles check
-- with a get_my_role() call, which can evaluate to NULL in policies and
-- silently block reads for staff.

-- support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS st_admin_all ON public.support_tickets;
CREATE POLICY st_admin_all ON public.support_tickets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.revoked_at IS NULL
        AND ur.role IN ('admin', 'super_admin', 'system_admin', 'support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.revoked_at IS NULL
        AND ur.role IN ('admin', 'super_admin', 'system_admin', 'support')
    )
  );
-- support_ticket_replies
DROP POLICY IF EXISTS str_admin_all ON public.support_ticket_replies;
CREATE POLICY str_admin_all ON public.support_ticket_replies
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.revoked_at IS NULL
        AND ur.role IN ('admin', 'super_admin', 'system_admin', 'support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.revoked_at IS NULL
        AND ur.role IN ('admin', 'super_admin', 'system_admin', 'support')
    )
  );
