-- MUSHIN — Add email to mushin_credit_type enum
-- Must be its own migration/transaction before any usage.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mushin_credit_type' AND typnamespace = 'public'::regnamespace) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.mushin_credit_type'::regtype
        AND enumlabel = 'email'
    ) THEN
      ALTER TYPE public.mushin_credit_type ADD VALUE 'email';
    END IF;
  END IF;
END $$;
