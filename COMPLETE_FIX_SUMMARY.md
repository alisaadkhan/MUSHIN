# InfluenceIQ Pro - Complete System Fix

## 🎯 What Was Broken

### 1. **History & Saved Searches** ❌
- Searches weren't being logged to database
- Couldn't save searches
- Couldn't delete saved searches

### 2. **Campaign Management** ❌
- Couldn't create new campaigns
- Campaign activity wasn't being logged
- Pipeline cards couldn't be managed

### 3. **Credit System** ❌
- Credits not deducting on search
- Credit balance not updating
- No usage tracking

---

## 🔍 Root Causes

### Database RLS Policies Missing
The Row Level Security (RLS) policies were incomplete:
- `search_history`: Only had SELECT, missing INSERT/DELETE
- `saved_searches`: Policy didn't cover all operations
- `campaigns`: Missing WITH CHECK clause for writes
- `campaign_activity`: Missing INSERT policy
- `credits_usage`: Missing INSERT policy

### Credit System Issues
- Functions required `service_role` but client was calling directly
- Missing proper error handling
- No automatic logging of credit usage

---

## ✅ Solution Applied

### Migration Files Created

1. **`20260421000000_fix_rls_policies.sql`**
   - Fixes all RLS policies for CRUD operations
   - Adds INSERT/DELETE policies where missing
   - Ensures workspace isolation

2. **`20260421010000_fix_credit_system.sql`**
   - Fixes credit deduction functions
   - Adds proper error handling
   - Creates `get_workspace_credits()` helper
   - Auto-logs credit usage

---

## 🚀 How to Apply Fixes

### Method 1: Supabase CLI (Recommended)

```bash
# 1. Install CLI (if needed)
npm install -g supabase

# 2. Login
npx supabase login

# 3. Link project (get ref from Dashboard)
npx supabase link --project-ref YOUR_PROJECT_REF

# 4. Apply all migrations
npx supabase db push

# 5. Verify
npx supabase migration list
```

### Method 2: Manual SQL (If CLI fails)

1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260421000000_fix_rls_policies.sql`
3. Paste and click **Run**
4. Repeat for `supabase/migrations/20260421010000_fix_credit_system.sql`

---

## 📋 Verification Checklist

After applying fixes, test each feature:

### ✅ Search History
- [ ] Perform a search
- [ ] Go to History page
- [ ] Search appears in timeline

### ✅ Saved Searches
- [ ] Save a search with a name
- [ ] View in Saved Searches page
- [ ] Delete the saved search
- [ ] Confirm deletion

### ✅ Campaigns
- [ ] Create new campaign
- [ ] Update campaign status
- [ ] Add pipeline cards
- [ ] View campaign activity log

### ✅ Credit System
- [ ] Check current credit balance
- [ ] Perform a search
- [ ] Verify credits decreased by 1
- [ ] Check credits_usage table for entry

### ✅ Edge Functions
- [ ] Search works
- [ ] AI search works
- [ ] Profile enrichment works
- [ ] Bot detection works

---

## 🛠️ Troubleshooting Commands

### Check Database Status
```bash
npx supabase status
npx supabase db diff
```

### View Migrations
```bash
npx supabase migration list
```

### Deploy Edge Functions
```bash
npx supabase functions deploy search-influencers
npx supabase functions deploy search-natural
npx supabase functions deploy enrich-influencer
```

### View Function Logs
```bash
npx supabase functions logs search-influencers
npx supabase functions logs --all
```

### Reset Database (Last Resort)
```bash
npx supabase db reset --linked
```

---

## 📊 SQL Verification Queries

Run these in Supabase Dashboard → SQL Editor:

### Check RLS Policies
```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename IN (
  'search_history', 'saved_searches', 'campaigns',
  'campaign_activity', 'credits_usage'
)
ORDER BY tablename;
```

### Check Credit Functions
```sql
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname IN (
  'consume_search_credit', 
  'consume_ai_credit', 
  'consume_enrichment_credit',
  'get_workspace_credits'
);
```

### Check Workspace Credits
```sql
SELECT 
  id,
  search_credits_remaining,
  ai_credits_remaining,
  enrichment_credits_remaining
FROM workspaces
WHERE id = 'YOUR_WORKSPACE_ID';
```

### View Credit Usage Log
```sql
SELECT 
  workspace_id,
  action_type,
  amount,
  created_at
FROM credits_usage
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔐 Security Notes

All fixes maintain security:
- ✅ Workspace isolation enforced
- ✅ Users can only access their workspace data
- ✅ Credit functions use SECURITY DEFINER with checks
- ✅ Service role required for credit deduction (via edge functions)
- ✅ RLS policies prevent cross-workspace access

---

## 📚 Documentation Files

- `RLS_POLICY_FIX.md` - Detailed RLS explanation
- `FIX_COMMANDS.md` - Complete command reference
- `QUICK_COMMANDS.md` - Quick reference card
- `CREDIT_SYSTEM_FIX.md` - Credit system details

---

## 🆘 Still Having Issues?

1. **Check Browser Console** - Look for client-side errors
2. **Check Supabase Logs** - Dashboard → Logs
3. **Check Function Logs** - `npx supabase functions logs`
4. **Verify Environment Variables** - Ensure `.env` is correct
5. **Test in Incognito** - Rule out cache issues

---

## 📞 Support Resources

- Supabase Docs: https://supabase.com/docs
- Edge Functions: https://supabase.com/docs/guides/functions
- RLS Guide: https://supabase.com/docs/guides/auth/row-level-security
- Project Issues: Check GitHub issues or contact support

---

**Last Updated:** April 21, 2026  
**Migrations Applied:** 2  
**Status:** ✅ Ready to Deploy
