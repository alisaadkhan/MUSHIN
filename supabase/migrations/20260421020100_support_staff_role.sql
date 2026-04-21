-- Support staff role + table (timestamped so CLI applies it)

-- Add support role to user_roles enum if it exists (legacy). If user_roles is text-based, this is a no-op.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
        AND enumlabel = 'support'
    ) THEN
      EXECUTE 'ALTER TYPE user_role ADD VALUE IF NOT EXISTS ''support''';
    END IF;
  END IF;
END $$;

-- Optional support staff table for additional fields
CREATE TABLE IF NOT EXISTS public.support_staff (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE,
  department TEXT DEFAULT 'support',
  permissions JSONB DEFAULT '{"tickets": true, "users": false, "billing": false}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_staff_view_own ON public.support_staff;
CREATE POLICY support_staff_view_own ON public.support_staff
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS support_staff_view_all ON public.support_staff;
CREATE POLICY support_staff_view_all ON public.support_staff
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin', 'system_admin')
        AND (revoked_at IS NULL OR revoked_at IS NULL)
    )
  );

CREATE INDEX IF NOT EXISTS idx_support_staff_dept ON public.support_staff(department);

