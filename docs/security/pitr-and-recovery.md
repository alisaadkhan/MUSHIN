## Point-in-Time Recovery (PITR) and Super Admin Restore

This app uses **Supabase Postgres**. Production-grade recovery is layered:

- **Layer 1 (Platform PITR / WAL)**: restore the entire database to a timestamp (pre-compromise) using Supabase’s PITR / backups.
- **Layer 2 (Targeted table rollback)**: restore only critical tables to an earlier timestamp using DB history tables via `public.restore_table_to_timestamp(...)` (super_admin only).
- **Layer 3 (Snapshot restore points)**: restore from logical snapshots captured into `public.system_restore_points` and executed through the existing `admin-restore-system` edge function (system_admin gated).

### Layer 1: Supabase PITR (recommended for full rewind)

Supabase PITR is a **platform feature** (WAL-based). Enable PITR at the Supabase project level and document your operational runbooks.

- **What it gives you**: full-database restoration to a specific timestamp.
- **When to use**: platform compromise, widespread data corruption, unknown blast radius.

Operational guidance:
- Prefer restoring to a time **just before** the first malicious action.
- After a PITR restore, treat all secrets/tokens as compromised and rotate them.

### Layer 2: Targeted rollback (super_admin only)

This repo adds:
- `public.critical_row_history` (immutable history log for critical tables)
- `public.restore_table_to_timestamp(table_name, timestamp, confirm, reason, dry_run)`

Usage pattern:
1) Dry run (returns counts, no mutation)
2) Execute (requires `confirm = true` and a non-trivial reason)

Example (SQL editor, authenticated as super_admin):

```sql
-- Dry run
select public.restore_table_to_timestamp(
  'user_roles',
  '2026-04-22T10:15:00Z'::timestamptz,
  false,
  null,
  true
);

-- Execute (requires confirmation + reason)
select public.restore_table_to_timestamp(
  'user_roles',
  '2026-04-22T10:15:00Z'::timestamptz,
  true,
  'Rollback roles to pre-compromise state after suspicious elevation.',
  false
);
```

### Layer 3: Snapshot restore points (existing)

This repo already includes:
- `public.create_restore_point(...)`
- `public.request_restore_confirmation(...)`
- `public.restore_from_snapshot(...)`
- edge function: `supabase/functions/admin-restore-system`

These snapshots are **logical** (JSON payload) and are best for “known-critical subsets” of data.

### “Supabase CLI” commands (always use `npx`)

If you use the Supabase CLI locally, ensure commands are invoked via `npx`:

```bash
# Pull schema/migrations (example)
npx supabase db pull

# Create a new migration (example)
npx supabase migration new security_recovery_notes

# Dump schema (example)
npx supabase db dump --schema-only
```

### Secrets rotation (post-incident)

Database restores do **not** rotate secrets. After any compromise response, rotate:
- Supabase service role key
- publishable/anon key (if exposure suspected)
- third-party API keys (email providers, AI providers, payment webhooks)
- JWT settings / session invalidation (revoke refresh tokens)

This repo includes a **logging-only hook**:
- `public.request_secrets_rotation(scope, reason)` (super_admin only)

It records the intent + timing in your audit systems; actual rotation is performed in Supabase/project settings and external providers.

