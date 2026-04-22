-- Ensure support staff can manage support tickets + replies (idempotent)

-- support_tickets
DROP POLICY IF EXISTS st_admin_all ON public.support_tickets;
CREATE POLICY st_admin_all
  ON public.support_tickets
  FOR ALL
  USING (public.get_my_role() IN ('admin', 'super_admin', 'support'));
-- support_ticket_replies
DROP POLICY IF EXISTS str_admin_all ON public.support_ticket_replies;
CREATE POLICY str_admin_all
  ON public.support_ticket_replies
  FOR ALL
  USING (public.get_my_role() IN ('admin', 'super_admin', 'support'));
