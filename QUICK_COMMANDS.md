# Quick Reference - Supabase Commands

## Essential Commands (Copy & Paste)

### Login & Link
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

### Apply All Fixes (One Command)
```bash
npx supabase db push
```

### Check Status
```bash
npx supabase status
npx supabase migration list
npx supabase function list
```

### Deploy Edge Functions
```bash
npx supabase functions deploy search-influencers
npx supabase functions deploy search-natural
npx supabase functions deploy enrich-influencer
npx supabase functions deploy detect-bot-entendre
npx supabase functions deploy send-outreach-email
npx supabase functions deploy ai-analytics
```

### View Logs
```bash
npx supabase functions logs search-influencers
npx supabase functions logs --all
```

### Database Operations
```bash
npx supabase db diff
npx supabase db reset --linked
npx supabase db dump
```

---

## Manual SQL Execution (Dashboard)

If CLI doesn't work, run these SQL files manually in Supabase Dashboard → SQL Editor:

1. `supabase/migrations/20260421000000_fix_rls_policies.sql`
2. `supabase/migrations/20260421010000_fix_credit_system.sql`

---

## Test After Fix

```bash
# Start dev server
npm run dev

# Run tests
npm run test

# E2E tests
npm run test:e2e
```

---

## Common Issues

**Problem:** Command not found  
**Fix:** `npm install -g supabase`

**Problem:** Not authenticated  
**Fix:** `npx supabase login`

**Problem:** Project not linked  
**Fix:** `npx supabase link --project-ref YOUR_REF`

**Problem:** Permission denied  
**Fix:** Use Dashboard SQL Editor instead of CLI
