# RLS Policy Fix - History, Saved Searches & Campaigns

## Problem Summary

Features requiring database writes (not edge functions) were failing silently:
- **Search History** - Searches weren't being logged to `search_history` table
- **Saved Searches** - Couldn't save or delete searches  
- **Campaign Creation** - Couldn't create new campaigns
- **Campaign Activity** - Campaign events weren't being logged

## Root Cause

**Missing or incomplete Row Level Security (RLS) policies** in the database:

### 1. search_history table
- ✅ Had: `FOR SELECT` policy (could read history)
- ❌ Missing: `FOR INSERT` policy (couldn't log new searches)
- ❌ Missing: `FOR DELETE` policy (couldn't clean up)

### 2. saved_searches table
- ⚠️ Had: Policy without explicit `FOR ALL` clause
- Issue: In some Supabase versions, policies without `FOR ALL` or explicit operation types may not cover INSERT/UPDATE/DELETE

### 3. campaigns table
- ⚠️ Had: Policy with only `USING` clause
- Issue: `WITH CHECK` clause needed for INSERT/UPDATE operations

### 4. campaign_activity table
- ✅ Had: `FOR SELECT` policy
- ❌ Missing: `FOR INSERT` policy (couldn't log campaign events)

### 5. credits_usage table
- ❌ Missing: `FOR INSERT` policy (couldn't track credit consumption)

## Solution

Applied migration: `20260421000000_fix_rls_policies.sql`

### Changes Made:

1. **search_history**
   - Added `FOR INSERT` policy for workspace members
   - Added `FOR DELETE` policy for cleanup

2. **saved_searches**
   - Replaced policy with `FOR ALL` + both `USING` and `WITH CHECK` clauses

3. **campaigns**
   - Replaced policy with `FOR ALL` + both `USING` and `WITH CHECK` clauses

4. **campaign_activity**
   - Added `FOR INSERT` policy for logging events

5. **credits_usage**
   - Added `FOR INSERT` policy for tracking usage

6. **influencer_profiles/cache/evaluations**
   - Added policies to allow edge function writes for enrichment

## How to Apply

Run the migration in Supabase Dashboard:

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20260421000000_fix_rls_policies.sql`
3. Paste and Run
4. Verify with the included verification query

## Verification

After applying the fix, test these features:

### Search History
1. Go to Search page
2. Perform a search
3. Go to History page
4. ✅ Should see the search logged

### Saved Searches
1. Go to Search page
2. Perform a search
3. Click "Save Search"
4. Enter a name and save
5. Go to Saved Searches page
6. ✅ Should see the saved search
7. Try deleting it
8. ✅ Should delete successfully

### Campaigns
1. Go to Campaigns page
2. Click "New Campaign"
3. Enter campaign details
4. Click Create
5. ✅ Campaign should be created
6. Try updating status
7. ✅ Status should update
8. Check campaign activity log
9. ✅ Should see activity events

## Technical Details

### RLS Policy Structure

```sql
-- Correct pattern for ALL operations:
CREATE POLICY "name" ON table_name
  FOR ALL
  USING (
    -- Check for SELECT, UPDATE, DELETE
    EXISTS (SELECT 1 FROM workspace_members WHERE ...)
  )
  WITH CHECK (
    -- Check for INSERT, UPDATE
    EXISTS (SELECT 1 FROM workspace_members WHERE ...)
  );
```

### Why This Happened

The original migration (`20260226_admin_rbac.sql`) created tables with RLS enabled but didn't include complete policies for all CRUD operations. This is a common issue when:
- Focusing on read operations first
- Assuming `USING` covers all operations
- Not testing write operations thoroughly

### Security Notes

All policies maintain workspace isolation:
- Users can only access data from workspaces they're members of
- Checks use `auth.uid()` to verify current user
- JOINs through `workspace_members` table enforce membership

## Related Files

- Migration: `supabase/migrations/20260421000000_fix_rls_policies.sql`
- Original schema: `supabase/migrations/20260226_admin_rbac.sql`
- Search history hook: `src/hooks/useSearchHistory.ts`
- Saved searches hook: `src/hooks/useSavedSearches.ts`
- Campaigns hook: `src/hooks/useCampaigns.ts`
- History page: `src/pages/HistoryPage.tsx`
- Saved searches page: `src/pages/SavedSearchesPage.tsx`
- Campaigns page: `src/pages/CampaignsPage.tsx`

## Edge Functions Status

Note: This fix does NOT affect edge functions. The following features correctly use edge functions and are working:
- ✅ `search-influencers` - Main search functionality
- ✅ `search-natural` - AI search
- ✅ `enrich-influencer` - Profile enrichment
- ✅ `detect-bot-entendre` - Bot detection
- ✅ `send-outreach-email` - Email campaigns
- ✅ `ai-analytics` - Analytics generation

The issue was specifically with **direct database operations** that bypass edge functions for performance/cost reasons.
