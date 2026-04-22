# Point-in-Time Recovery (PITR) & Security Runbook

This document outlines the operational procedures for data recovery and security response on the InfluenceIQ-Pro platform.

## 1. Data Recovery Strategy

Recovery is handled through a three-layered approach depending on the severity and scope of the data loss or compromise.

### Layer 1: Platform PITR (Supabase Managed)
**Scope**: Full database restoration.
**When to use**: Widespread data corruption, platform-wide compromise, or catastrophic accidental deletion.
**Procedure**:
1. Log in to the **Supabase Dashboard**.
2. Navigate to **Database > Backups**.
3. Select **Point-in-Time Recovery**.
4. Choose the target timestamp (restore to a point *before* the incident).
5. Follow Supabase's restoration workflow.
6. **Post-Restore**: Verify RLS policies and regenerate any Edge Function secrets if they were modified post-timestamp.

### Layer 2: Targeted Table Rollback (Super Admin)
**Scope**: Individual critical tables.
**When to use**: Malicious data modification on specific tables (e.g., role elevation, credit theft, subscription tampering).
**Mechanism**: Uses `public.critical_row_history` to reconstruct state.
**Procedure**:
1. Identify the compromised table and the exact timestamp before the incident.
2. **Dry Run First**:
   ```sql
   SELECT public.restore_table_to_timestamp(
     'user_roles',
     '2026-04-22T10:00:00Z'::timestamptz,
     false, -- confirm
     'Investigating suspicious role elevation',
     true   -- dry_run
   );
   ```
3. **Execute Rollback**:
   ```sql
   SELECT public.restore_table_to_timestamp(
     'user_roles',
     '2026-04-22T10:00:00Z'::timestamptz,
     true,
     'Reverting role elevation for 5 accounts identified in audit logs.',
     false
   );
   ```
4. **Supported Tables**: `profiles`, `workspaces`, `workspace_members`, `user_roles`, `subscriptions`, `paddle_subscriptions`, `usage_limits`, `credit_transactions`, `support_tickets`, `support_ticket_replies`, `support_staff_rbac`.

### Layer 3: System-Wide Snapshot (System Admin)
**Scope**: Logical snapshot of critical system state.
**When to use**: Quick rollback of configuration or core user/workspace state via logical JSON snapshots.
**Mechanism**: `public.system_restore_points` + `admin-restore-system` Edge Function.
**Procedure**:
1. **Create Restore Point** (Regular maintenance):
   ```sql
   SELECT public.create_restore_point('Pre-migration snapshot - 2026-04-22');
   ```
2. **Restore from Snapshot**:
   - Use the Admin Panel (Security section) or call the `admin-restore-system` Edge Function.
   - Requires a `confirmation_token` generated via `public.request_restore_confirmation(restore_point_id)`.

---

## 2. Secrets Rotation Workflow

Following a suspected compromise or credential leak, secrets must be rotated immediately.

### Audit Trigger
Before manual rotation, log the intent to ensure administrative accountability:
```sql
SELECT public.request_secrets_rotation('Detected potential leak of Stripe webhook secret in logs.');
```

### Manual Rotation Steps
1. **Supabase Service Keys**: Rotate via Supabase Dashboard > Settings > API.
2. **Stripe/Paddle Keys**: Rotate in the respective provider's dashboard and update Supabase Edge Function secrets:
   ```bash
   npx supabase secrets set STRIPE_SECRET_KEY=...
   ```
3. **AI Provider Keys (OpenAI/Anthropic)**: Rotate in provider dashboard and update secrets.
4. **SMTP/Email Credentials**: Update in Supabase Settings > Auth.

---

## 3. Post-Incident Response

1. **Lockdown**: Set `KILL_SWITCH_EXPENSIVE_ENDPOINTS = true` in environment variables if the attack is ongoing.
2. **Audit Review**: Examine `public.audit_logs` and `public.system_audit_logs` for actor IDs and IP addresses.
3. **Session Termination**: Terminate suspicious sessions via the Admin Panel or `auth.users` management.
4. **Revoke Access**: Use `public.user_roles` to set `revoked_at` for any compromised administrative accounts.

---

## 4. Maintenance

- **Audit Purge**: Audit logs are immutable by default. Periodic archival to cold storage is recommended every 90 days.
- **History Retention**: `public.critical_row_history` should be pruned periodically (e.g., keeping only the last 30 days of history) to manage database size.
