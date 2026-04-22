-- MUSHIN — Required extensions
-- Supabase commonly installs extensions into the `extensions` schema.
-- We create the schema explicitly and install pgcrypto there so calls like
-- `extensions.digest(...)` are always available.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
