## MUSHIN — Backup & Recovery Runbook (Supabase/Postgres)

This document covers **snapshots**, **PITR (point-in-time recovery)**, and **restoring critical tables** for MUSHIN.

### Scope (critical data)
- **Auth**: `auth.users` (managed by Supabase Auth)
- **RBAC**: `public.user_roles`
- **Workspaces**: `public.workspaces`, `public.workspace_members`
- **Ledger credits**: `public.credit_transactions`, `public.user_credit_balances` (view)
- **Billing**: `public.paddle_*` (or `subscriptions` if used), `public.credit_costs`
- **Audit**: `public.system_audit_logs` (immutable), `public.security_alerts`, `public.support_actions_log`

### 1) Managed backups (recommended for production)
- **Daily automated backups**: enable in Supabase project settings.
- **PITR**: enable PITR (retention depends on plan). This is the safest recovery path for production incidents.

### 2) On-demand logical backups (CLI)
Prereqs: logged into Supabase, project linked, Docker running.

- **Dump schema + data** (safe for small/medium datasets):

```bash
npx supabase db dump --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" --file "backup.local.sql"
```

- **Dump schema only**:

```bash
npx supabase db dump --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" --schema-only --file "backup.schema.sql"
```

Notes:
- For hosted Supabase, use the **project DB connection string** (NOT local `:54322`).
- Logical dumps are slower than snapshots, but portable.

### 3) Point-in-time recovery (PITR) workflow (production)
Use PITR when you need to roll back to just before an incident (bad migration, accidental delete, abusive credit grants).

- **Pick a timestamp** just before the incident.
- **Run PITR restore** in Supabase dashboard (or provider tooling).
- **Post-restore verification**:
  - Verify `system_audit_logs` continuity.
  - Verify `credit_transactions` and computed balances.
  - Verify Auth sign-in works.

### 4) “Restore critical tables” playbook (surgical)
If you cannot PITR, restore just the critical tables from a dump.

#### 4.1 Credits ledger restore
- Restore ledger table:

```sql
-- Run inside a transaction where possible
TRUNCATE public.credit_transactions;
-- then replay inserts from dump for credit_transactions
```

- Validate balances:

```sql
SELECT credit_type, balance
FROM public.user_credit_balances
WHERE user_id = '<USER_ID>'::uuid
  AND workspace_id = '<WORKSPACE_ID>'::uuid;
```

#### 4.2 RBAC restore

```sql
TRUNCATE public.user_roles;
-- replay inserts for user_roles from dump
```

#### 4.3 Audit log restore (append-only)
- Prefer not to truncate `system_audit_logs`.
- If restoring, treat it as write-once; validate chain integrity using `prev_hash` / `log_hash`.

### 5) Built-in “Restore Points” (in-app snapshots)
MUSHIN includes a server-side restore-point system (admin gated):
- `public.system_restore_points`
- RPCs: `public.create_restore_point`, `public.restore_from_snapshot`

This is useful for **application-level** restore of MUSHIN tables, but it is not a substitute for PITR.

### 6) Minimum verification checklist after any restore
- **Auth**: sign in with a test account
- **RBAC**: ensure at least one `super_admin/system_admin` exists
- **Credits**: run a search, confirm ledger debit + UI updates
- **Admin**: open `/admin/audit-log`, confirm new events appear
- **Support**: open `/support/dashboard`, confirm lookup works and support logs append

