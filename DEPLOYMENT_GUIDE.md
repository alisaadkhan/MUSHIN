# MUSHIN Deployment Guide

**Current Status:** All fixes committed (17 commits) but NOT deployed to production

---

## What's Fixed in Code (Not Yet Live)

### 16 Bug Fixes Ready to Deploy:
1. ✅ Credit system - atomic locking
2. ✅ Search defaults to 10k+ followers
3. ✅ YouTube profile stats (Subscribers, Videos, Following, Engagement)
4. ✅ Instagram profile stats (Followers, Following, Engagement, Posts)
5. ✅ TikTok profile stats (Followers, Posts, Likes, Engagement)
6. ✅ Data authenticity verified
7. ✅ API notice removed (including Apify badge)
8. ✅ Saved searches working
9. ✅ Campaigns working
10. ✅ Support tickets visible on admin
11. ✅ TikTok followers extraction fixed
12. ✅ Bios cleaned (no snippets)
13. ✅ Sidebar plan flash fixed
14. ✅ Search history saving
15. ✅ Campaign creation working
16. ✅ TikTok/Instagram search not empty

### Email Sending UI:
✅ **Already exists** in the code:
- `BulkEmailDialog` - for sending emails to multiple creators
- `SendEmailDialog` - for single creator emails
- Located in Kanban board (Campaigns page)
- **Button:** "Send Email" appears when you select creators in a campaign

---

## Deployment Steps

### Step 1: Push Code to Git

```bash
cd "D:\New folder (2)\influenceiq-pro"
git push
```

### Step 2: Deploy Edge Functions

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to Supabase
supabase login

# Deploy search function
supabase functions deploy search-influencers --project-ref YOUR_PROJECT_REF

# Deploy enrichment function
supabase functions deploy enrich-influencer --project-ref YOUR_PROJECT_REF
```

**Find your project ref:**
1. Go to https://supabase.com/dashboard
2. Click your project
3. Go to Settings > API
4. Copy the "Project reference" value

### Step 3: Vercel Auto-Deploy

Once you push to git, Vercel will automatically:
1. Detect the push
2. Build the project
3. Deploy to production

**Check deployment status:**
1. Go to https://vercel.com/dashboard
2. Find your MUSHIN project
3. Watch the deployment progress

### Step 4: Verify Deployment

After Vercel shows "Ready":

1. **Visit production site:** `https://your-domain.com`
2. **Test search:** Search for "Pakistani Gaming" - should show results with 10k+ followers
3. **Test profile:** Click a creator - should show correct platform-specific stats
4. **Test campaigns:** Go to Campaigns page - should work without errors
5. **Test email:** In a campaign Kanban, select creators → click "Send Email" button

---

## Email Sending UI Location

The email sending feature is in the **Campaigns Kanban Board**:

### How to Access:
1. Go to `/campaigns`
2. Create or open a campaign
3. Add creators to the campaign (via "Add Creators" button)
4. **Select creators** by clicking checkboxes
5. Click **"Send Email"** button (appears in the bulk action bar)
6. Choose email template or write custom email
7. Send!

### Alternative (Single Creator):
1. Click on any creator card in the Kanban
2. Click **"Send Email"** in the card details
3. Write and send email

---

## Post-Deployment Checklist

After deploying, verify these work:

### Search
- [ ] Search defaults to 10k-50k follower range
- [ ] TikTok search shows results (not empty)
- [ ] Instagram search shows results
- [ ] Bios are clean (no "19K followers ·" prefixes)
- [ ] Follower counts show on cards (not "—")

### Profile Pages
- [ ] YouTube: Shows "Subscribers", "Videos", "Following", "Engagement"
- [ ] Instagram: Shows "Followers", "Following", "Engagement", "Posts"
- [ ] TikTok: Shows "Followers", "Posts", "Likes", "Engagement"
- [ ] No API notice visible

### Campaigns
- [ ] Can create campaigns
- [ ] Kanban board loads
- [ ] Can add creators to campaign
- [ ] "Send Email" button appears when creators selected
- [ ] Email dialog opens correctly

### Admin
- [ ] Support tickets visible on admin panel
- [ ] Can view all user tickets

### Sidebar
- [ ] No "Free Plan" flash on load
- [ ] Credits display correctly after loading

---

## Troubleshooting

### If Vercel Build Fails:
1. Check Vercel dashboard for error logs
2. Common issues:
   - Missing environment variables
   - Build timeout (increase in Vercel settings)
   - Node version mismatch (should be 18+)

### If Edge Functions Fail:
```bash
# Check function logs
supabase functions logs search-influencers

# Redeploy with verbose output
supabase functions deploy search-influencers --verify
```

### If Email Sending Doesn't Work:
1. Check Redis secrets in Supabase dashboard
2. Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set
3. Check email credits in Billing page

---

## Environment Variables Required

Make sure these are set in **both** Vercel and Supabase:

### Vercel Environment Variables:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Edge Function Secrets:
```
SERPER_API_KEY=your-serper-key
YOUTUBE_API_KEY=your-youtube-key
APIFY_API_KEY=your-apify-key
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

---

## Quick Deploy Script

Save this as `deploy.sh`:

```bash
#!/bin/bash

echo "🚀 Deploying MUSHIN..."

# Step 1: Git push
echo "📦 Pushing to git..."
git add .
git commit -m "Deploy: all bug fixes"
git push

# Step 2: Deploy edge functions
echo "⚡ Deploying edge functions..."
supabase functions deploy search-influencers
supabase functions deploy enrich-influencer

# Step 3: Wait for Vercel
echo "⏳ Waiting for Vercel deployment..."
echo "Check: https://vercel.com/dashboard"

echo "✅ Deployment initiated!"
```

Run with:
```bash
bash deploy.sh
```

---

## Support

If you encounter issues:
1. Check Vercel logs: https://vercel.com/dashboard
2. Check Supabase logs: https://supabase.com/dashboard > Logs
3. Review deployment checklist above
4. Test each feature individually

---

**Ready to deploy?** Run `git push` and follow the steps above.
