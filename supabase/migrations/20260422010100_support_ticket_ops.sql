-- Support ticket operations hardening:
-- - Add ticket_number for human-friendly tracking
-- - Add assignment fields (assigned_to / assigned_at)
-- - Allow support role to manage tickets/replies (RLS)

-- 1) Ticket number (sequence-based)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'support_ticket_number_seq') THEN
    CREATE SEQUENCE public.support_ticket_number_seq START 10001;
  END IF;
END $$;
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ticket_number bigint;
-- Backfill existing rows
UPDATE public.support_tickets
SET ticket_number = nextval('public.support_ticket_number_seq')
WHERE ticket_number IS NULL;
-- Default for new rows
ALTER TABLE public.support_tickets
  ALTER COLUMN ticket_number SET DEFAULT nextval('public.support_ticket_number_seq');
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_ticket_number
  ON public.support_tickets(ticket_number);
-- 2) Assignment / handling
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to
  ON public.support_tickets(assigned_to);
-- 3) RLS policy: allow support role too
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
