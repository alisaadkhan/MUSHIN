# Final Admin Control Plane Deployment Report

Date: 2026-03-13
Project Ref: xfeikbhprbqwzdhyjnou

## Phase 1 — Supabase CLI Access

Completed:
- CLI reachable via npx
- Version verified: `2.78.1`
- Project linked successfully:
  - `npx supabase link --project-ref xfeikbhprbqwzdhyjnou`

Note:
- Interactive `supabase login` prompt is not reliable in this non-interactive terminal, but API auth was valid (projects listing, migration operations, and function deploys succeeded).

## Phase 2 — Migration History Divergence

Observed divergence on migration `20260325`.

Actions taken:
- Used `supabase migration repair` repeatedly per CLI guidance.
- Stable workaround used during push operations:
  1. `npx supabase migration repair --status reverted 20260325`
  2. `npx supabase db push --include-all`

Result:
- Migration execution unblocked and `20260328_admin_control_plane.sql` applied successfully.

Residual note:
- `supabase migration list` still reports asymmetric entries for `20260325` (local/remote split), but this no longer blocks applying current migrations when the above repair step is run first.

## Phase 3 — Database Migrations Applied

Applied successfully:
- `20260327_credit_rpc_hardening.sql`
- `20260328_admin_control_plane.sql`

Required objects verified present remotely (via PostgREST service-role queries):
- `system_audit_logs`
- `system_restore_points`
- `system_restore_confirmations`
- `admin_user_activity_view`
- `admin_workspace_activity_view`
- `admin_credit_history_view`

Migration compatibility fixes applied during deployment:
- Replaced `profiles.email` references with `auth.users.email`
- Removed hard dependency on `enrichment_jobs.user_id`
- Updated credit history view to avoid nonexistent `credits_usage.metadata` column

## Phase 4 — Edge Functions Deployed

Successfully deployed:
- `admin-get-user`
- `admin-adjust-credits`
- `admin-set-plan`
- `admin-get-audit-log`
- `admin-create-restore-point`
- `admin-restore-system`

All functions were redeployed after final shared gateway fixes.

## Phase 5 — Post-Deployment Validation

Validated:
1. Admin endpoints require authentication
   - Unauthenticated calls to all six endpoints returned `401`.

2. Audit log infrastructure is operational
   - `system_audit_logs` queryable remotely.

3. Audit immutability behavior enforced
   - Inserted test audit row, update attempt returned `400` (blocked as expected).

Partially validated (requires real system_admin user token to complete end-to-end):
- Full `system_admin` versus non-admin `403` path
- Live credit mutation and plan override behavior
- End-to-end restore create + confirmation + execute flow

## Phase 6 — Security Verification

Confirmed:
- Audit table is append-only in practice (update blocked)
- Admin data structures include actor/target/workspace metadata support
- Restore model includes two-step confirmation records and token expiry model
- Service-role secret usage remains isolated to privileged gateway:
  - only `supabase/functions/_shared/privileged_gateway.ts` references `SUPABASE_SERVICE_ROLE_KEY`

## Final Status

Deployment status: **SUCCESSFUL** for schema + function rollout.

Operational status:
- Admin Control Plane schema is installed.
- Admin endpoints are live.
- Audit and restore subsystems are present and reachable.

Follow-up recommendation:
- Resolve the persistent `20260325` migration-history asymmetry permanently in a dedicated cleanup pass (without changing runtime behavior), to remove the need for repair-before-push in future deployments.
