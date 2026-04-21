# Complete Fix Commands - InfluenceIQ Pro

## Quick Start - Run All Fixes

Copy and paste these commands one by one into your terminal:

### 1. Link Supabase Project (if not already linked)
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```
> Replace `YOUR_PROJECT_REF` with your actual Supabase project reference (found in Supabase Dashboard → Settings → General)

### 2. Check Current Status
```bash
npx supabase status
```

### 3. Apply RLS Policy Fixes
```bash
npx supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres"
```

**OR** manually run the migration in Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql/new
2. Copy contents from: `supabase/migrations/20260421000000_fix_rls_policies.sql`
3. Paste and click **Run**

### 4. Apply Credit System Fixes
```bash
npx supabase db push --db-url "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres"
```

**OR** manually run the migration in Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_REF/sql/new
2. Copy contents from: `supabase/migrations/20260421010000_fix_credit_system.sql`
3. Paste and click **Run**

### 5. Verify Database Functions
```bash
npx supabase function serve --env-file .env
```

---

## Alternative: Using Supabase CLI (Recommended)

If you have the Supabase CLI installed and project linked:

### Step 1: Ensure Supabase CLI is installed
```bash
npm install -g supabase
```

### Step 2: Login to Supabase
```bash
npx supabase login
```

### Step 3: Link your project
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

### Step 4: Check database schema status
```bash
npx supabase db diff
```

### Step 5: Push all migrations
```bash
npx supabase db push
```

### Step 6: Verify migrations applied
```bash
npx supabase migration list
```

---

## Manual SQL Execution (If CLI doesn't work)

### Option A: Run via SQL Editor

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Navigate to **SQL Editor** → **New Query**

2. **Apply RLS Fix Migration**
   ```bash
   npx supabase db reset --linked
   ```
   OR manually copy/paste from file:
   - File: `supabase/migrations/20260421000000_fix_rls_policies.sql`

3. **Apply Credit System Fix Migration**
   - File: `supabase/migrations/20260421010000_fix_credit_system.sql`

### Option B: Run via psql

```bash
# Get your database connection string from Supabase Dashboard
# Settings → Database → Connection string → URI

npx supabase db reset --linked
```

---

## Verification Steps

After applying the fixes, verify everything is working:

### 1. Test Search History
```bash
# 1. Open your app
npm run dev

# 2. Go to Search page
# 3. Perform a search
# 4. Go to History page
# Expected: Search should appear in history
```

### 2. Test Saved Searches
```bash
# 1. Go to Search page
# 2. Perform a search
# 3. Click "Save Search" button
# 4. Enter a name and save
# 5. Go to Saved Searches page
# Expected: Saved search should appear
# 6. Try deleting it
# Expected: Should delete successfully
```

### 3. Test Campaign Creation
```bash
# 1. Go to Campaigns page
# 2. Click "New Campaign"
# 3. Enter campaign details
# 4. Click Create
# Expected: Campaign should be created
# 5. Try updating the campaign status
# Expected: Status should update
```

### 4. Test Credit System
```bash
# 1. Check current credits in Dashboard
# 2. Perform a search
# 3. Check credits again
# Expected: Credits should decrease by 1

# Or run SQL query in Supabase Dashboard:
SELECT search_credits_remaining, ai_credits_remaining, enrichment_credits_remaining 
FROM workspaces 
WHERE id = 'YOUR_WORKSPACE_ID';
```

### 5. Verify Database Functions
Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Check if functions exist
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname IN (
  'consume_search_credit', 
  'consume_ai_credit', 
  'consume_enrichment_credit',
  'get_workspace_credits'
);

-- Check function permissions
SELECT 
  r.routine_name,
  r.routine_schema,
  p.privilege_type,
  p.grantee
FROM information_schema.routines r
LEFT JOIN information_schema.routine_privileges p 
  ON r.routine_name = p.routine_name
WHERE r.routine_name IN (
  'consume_search_credit', 
  'consume_ai_credit', 
  'consume_enrichment_credit',
  'get_workspace_credits'
)
ORDER BY r.routine_name;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN (
  'search_history', 
  'saved_searches', 
  'campaigns', 
  'campaign_activity', 
  'credits_usage'
)
ORDER BY tablename, policyname;
```

---

## Troubleshooting

### Issue: "Command not found: supabase"
**Solution:** Install Supabase CLI globally
```bash
npm install -g supabase
```

### Issue: "Project not linked"
**Solution:** Link your project
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

### Issue: "Permission denied" when running migrations
**Solution:** Use the service role key or run via Dashboard

### Issue: "Function does not exist"
**Solution:** Re-run the credit system migration
```bash
npx supabase db reset --linked
```

### Issue: Credits not deducting
**Solution:** Check if edge functions are deployed
```bash
npx supabase functions deploy search-influencers
npx supabase functions deploy search-natural
npx supabase functions deploy enrich-influencer
```

---

## Deploy Edge Functions (If needed)

If search or enrichment isn't working:

```bash
# Deploy all edge functions
npx supabase functions deploy search-influencers
npx supabase functions deploy search-natural
npx supabase functions deploy enrich-influencer
npx supabase functions deploy detect-bot-entendre
npx supabase functions deploy send-outreach-email
npx supabase functions deploy ai-analytics
```

---

## Check Function Logs

To debug edge function issues:

```bash
# Tail logs for a specific function
npx supabase functions logs search-influencers

# View all function logs
npx supabase functions logs
```

---

## Environment Variables Check

Ensure your `.env` file has these required variables:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SERPER_API_KEY=your_serper_key
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

---

## Final Verification Checklist

- [ ] RLS policies applied successfully
- [ ] Credit deduction functions working
- [ ] Search history logging works
- [ ] Saved searches CRUD operations work
- [ ] Campaign creation works
- [ ] Campaign activity logging works
- [ ] Credits deduct on search
- [ ] Edge functions deployed
- [ ] No console errors in browser
- [ ] All features tested end-to-end

---

## Support

If issues persist:

1. Check Supabase Dashboard → Database → Logs for errors
2. Check Edge Function logs in Dashboard
3. Review browser console for client-side errors
4. Verify all environment variables are set correctly
5. Ensure database migrations ran without errors
