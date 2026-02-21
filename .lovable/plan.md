

# Daily Credit Reset Cron Job for Free Tier

## Overview

Create a scheduled backend function that runs daily at midnight (UTC) to reset search credits for all free-tier workspaces back to 3.

## How It Works

Every day at midnight, a scheduled task will:
1. Find all workspaces on the free plan
2. Reset their `search_credits_remaining` to 3
3. Update the `credits_reset_at` timestamp

## Technical Details

### 1. Create Edge Function: `reset-free-credits`

A new backend function at `supabase/functions/reset-free-credits/index.ts` that:
- Uses the service role client (no user auth needed -- invoked by cron)
- Runs a single UPDATE query:
  ```
  UPDATE workspaces
  SET search_credits_remaining = 3, credits_reset_at = now()
  WHERE plan = 'free'
  ```
- Returns the count of updated workspaces
- Validates a shared secret or Authorization header to prevent unauthorized calls

### 2. Schedule the Cron Job

Use `pg_cron` + `pg_net` extensions to invoke the function every day at midnight UTC:

```text
Schedule: 0 0 * * *   (daily at 00:00 UTC)
Target:   POST /functions/v1/reset-free-credits
```

This requires enabling the `pg_cron` and `pg_net` extensions, then inserting a `cron.schedule` entry via SQL.

### 3. Config Update

Add the function entry to `supabase/config.toml`:
```
[functions.reset-free-credits]
verify_jwt = false
```

### 4. Files Changed

| File | Action |
|------|--------|
| `supabase/functions/reset-free-credits/index.ts` | Create -- edge function that resets free tier credits |
| `supabase/config.toml` | Update -- add function config entry |
| Database (SQL insert) | Schedule cron job via `cron.schedule` |

### Note on the other requests

- **vecterprime1234@gmail.com** is already provisioned as a Business account (done in the previous steps).
- **Testing the credits exhausted popup** is a manual testing step: sign up a new free account, perform 3 searches to exhaust credits, then attempt a 4th search to trigger the popup.

