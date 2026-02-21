

# Provision vecterprime1234@gmail.com as Business Account

## What will be done

Two database updates to set the account to the **Business** tier:

1. **Upsert subscription record** in `subscriptions` table for workspace `98f0b8d1-63b4-4dba-9c48-ae07d6fdcb89`:
   - Plan: `business`
   - Status: `active`
   - Period: 1 year from now

2. **Update workspace** `98f0b8d1-63b4-4dba-9c48-ae07d6fdcb89`:
   - Plan: `business`
   - Search credits: 2,000
   - Enrichment credits: 500
   - Email sends: 2,000
   - AI credits: 999 (unlimited equivalent)

## Technical Details

| Table | Field | Value |
|-------|-------|-------|
| `subscriptions` | `workspace_id` | `98f0b8d1-63b4-4dba-9c48-ae07d6fdcb89` |
| `subscriptions` | `plan` | `business` |
| `subscriptions` | `status` | `active` |
| `subscriptions` | `stripe_customer_id` | `manual_business` |
| `subscriptions` | `current_period_end` | 1 year from now |
| `workspaces` | `plan` | `business` |
| `workspaces` | `search_credits_remaining` | 2000 |
| `workspaces` | `enrichment_credits_remaining` | 500 |
| `workspaces` | `email_sends_remaining` | 2000 |
| `workspaces` | `ai_credits_remaining` | 999 |

No code changes required -- the existing `check-subscription` edge function already has a database fallback that will detect this manually provisioned subscription.

