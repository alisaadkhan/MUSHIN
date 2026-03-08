# API Keys Setup Report — Mushin Platform

**Date:** March 7, 2026  
**Status:** 3 features currently broken due to missing API key configuration

---

## Executive Summary

Three core features of the Mushin platform are non-functional in the live environment:

| Feature | Error Shown to User | Root Cause |
|---------|---------------------|------------|
| Enrich Profile (Instagram / TikTok) | "Enrichment service is unavailable" | `APIFY_API_KEY` not set |
| Enrich Profile (YouTube) | "Enrichment service is unavailable" | `YOUTUBE_API_KEY` not set |
| AI Insights / Evaluate Influencer | "AI evaluation service is unavailable" | `LOVABLE_API_KEY` not set |

All three errors present as `Edge Function returned a non-2xx status code` before the friendly message fix was applied. The edge functions are deployed and running — they fail only because the API keys are absent from the Supabase secrets configuration.

---

## Issue 1 — Influencer Enrichment (Instagram & TikTok)

### What it does
Clicking **"Enrich Profile"** on any Instagram or TikTok influencer triggers the `enrich-influencer` edge function. It calls the **Apify** web scraping platform to fetch real follower counts, engagement rates, recent posts, bio information, and linked social handles.

### What's missing
**Environment variable:** `APIFY_API_KEY`

### What happens without it
The edge function detects the missing key at line 363 of `supabase/functions/enrich-influencer/index.ts` and returns HTTP 503. The user sees a toast saying "Enrichment service is unavailable."

### How to get the key

1. Go to [https://console.apify.com](https://console.apify.com) and create a free account (or log in if you already have one).
2. In the left sidebar, click your profile name → **Settings** → **Integrations**.
3. Under **API tokens**, click **+ Add new token**. Give it a name like `mushin-production`.
4. Copy the token — it looks like `apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.

### Pricing
Apify offers a **free tier** with $5/month of platform credits — enough for approximately 500 profile enrichments. The actors used are:
- `apify~instagram-profile-scraper` (Instagram)
- `clockworks~tiktok-profile-scraper` (TikTok)

For production scale, the **Starter plan at $49/month** gives $49 in credits.

### How to configure it in Supabase

**Via Supabase Dashboard (recommended):**
1. Open your Supabase project dashboard.
2. Go to **Edge Functions** in the left sidebar.
3. Click **Manage secrets** (or navigate to **Project Settings → Edge Functions → Secrets**).
4. Click **New secret**.
5. Name: `APIFY_API_KEY` — Value: your token from Apify.
6. Click **Save**.

**Via Supabase CLI:**
```bash
supabase secrets set APIFY_API_KEY=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Issue 2 — Influencer Enrichment (YouTube)

### What it does
When enriching a **YouTube** influencer, the `enrich-influencer` edge function uses the **YouTube Data API v3** directly (not Apify) to fetch channel statistics, subscriber count, video performance, and engagement data.

### What's missing
**Environment variable:** `YOUTUBE_API_KEY`

### What happens without it
The function throws `"YOUTUBE_API_KEY is not configured."` at line 367, which causes enrichment to fail. The fallback cache is checked but typically has no enriched data for YouTube profiles, so the user sees a failure toast.

### How to get the key

1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project (or select an existing one).
3. In the navigation menu, go to **APIs & Services → Library**.
4. Search for **"YouTube Data API v3"** and click **Enable**.
5. Go to **APIs & Services → Credentials**.
6. Click **+ Create Credentials → API key**.
7. Copy the key — it looks like `AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
8. (Recommended) Click **Edit API key** and restrict it to **YouTube Data API v3** and your server's IP for security.

### Pricing
YouTube Data API v3 is **free** with a default quota of **10,000 units per day**. A typical channel lookup costs approximately 103 units. This means roughly **97 free YouTube enrichments per day** on the free quota.

If you need more, you can request a quota increase in the Google Cloud Console at no extra cost (requires a brief justification form).

### How to configure it in Supabase

**Via Supabase Dashboard:**
1. Go to **Project Settings → Edge Functions → Secrets**.
2. Click **New secret**.
3. Name: `YOUTUBE_API_KEY` — Value: your Google API key.
4. Click **Save**.

**Via Supabase CLI:**
```bash
supabase secrets set YOUTUBE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Issue 3 — AI Insights, AI Evaluation & Smart Search

### What it does
Five edge functions use AI capabilities:
- `ai-insights` — Summarize influencer profiles, fraud detection, campaign recommendations, influencer evaluation scoring
- `search-natural` — Natural language search ("find beauty influencers in Karachi with high engagement")
- `generate-embeddings` — Semantic similarity search for lookalike discovery (vector embeddings via BAAI/bge-large-en-v1.5)
- `extract-brand-mentions` — Detect sponsored content in post captions
- `classify-niche` — Auto-classify influencer category (Lifestyle, Tech, Beauty, etc.)

All five route through the **HuggingFace Inference API** using models:
- Text generation: `mistralai/Mistral-7B-Instruct-v0.2`
- Embeddings: `BAAI/bge-large-en-v1.5` (1024-dimensional vectors)

### What's missing
**Environment variable:** `HUGGINGFACE_API_KEY`

### What happens without it
The `ai-insights` function returns HTTP 503 with `{ error: "AI features are temporarily unavailable" }`. The user sees a toast saying "AI evaluation service is unavailable." Natural language search silently falls back to keyword matching. The "Find Similar Creators" feature on influencer profiles will return no results (embedding similarity requires the key).

### How to get the key

1. Go to [https://huggingface.co](https://huggingface.co) and create a free account (or log in).
2. Click your profile icon → **Settings** → **Access Tokens**.
3. Click **New token**. Choose type **Read** (sufficient for inference) or **Write**.
4. Give it a name like `mushin-production` and click **Generate a token**.
5. Copy the token — it looks like `hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.

### Pricing
HuggingFace Inference API offers a **free tier** with rate limits sufficient for development and low-volume production. For higher throughput, the **PRO plan at $9/month** provides priority access and higher rate limits. Enterprise plans are also available.

> **Note:** The AI features consume **AI credits** tracked in the `workspaces.ai_credits_remaining` column. Credits are deducted before each AI call and restored if the call fails. If a workspace has 0 credits, the function returns HTTP 402 regardless of whether the key is set.

### How to configure it in Supabase

**Via Supabase Dashboard:**
1. Go to **Project Settings → Edge Functions → Secrets**.
2. Click **New secret**.
3. Name: `HUGGINGFACE_API_KEY` — Value: your token from HuggingFace.
4. Click **Save**.

**Via Supabase CLI:**
```bash
supabase secrets set HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Setting All Three Keys at Once (CLI)

If you have the Supabase CLI installed and are logged in, you can set all keys in one command:

```bash
supabase secrets set \
  APIFY_API_KEY=apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  YOUTUBE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

After setting secrets, **no redeployment is needed** — Supabase injects secrets into running edge functions automatically within a few seconds.

---

## Optional Keys (Degraded but Not Broken)

These keys are not required for core features but enable additional capabilities:

| Secret Name | Purpose | Without it |
|-------------|---------|------------|
| `PYTHON_ANALYTICS_URL` | Advanced bot detection analytics | Analytics tab returns "not configured" gracefully |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Rate limiting & search result caching | Rate limiting disabled; searches hit DB every time |
| `RESEND_API_KEY` | Outreach email sending | Email outreach feature fails |
| `ANALYTICS_SECRET` | Authenticates the Python analytics microservice | Analytics service rejects requests |

---

## Verification Checklist

After setting the keys, verify each feature works:

- [ ] Open any Instagram influencer profile → click **Enrich Profile** → should show "Enriching..." then update with real data
- [ ] Open any TikTok influencer profile → click **Enrich Profile** → same
- [ ] Open any YouTube influencer profile → click **Enrich Profile** → same
- [ ] Open any enriched influencer profile → click **Evaluate with AI** → should show a score panel with authenticity, engagement rating, demographics
- [ ] Open any influencer profile → click **AI Summary** → should return a 2–3 sentence summary
- [ ] Use the **natural language search** bar with a phrase like "food influencers in Lahore" → should return semantically matched results

You can also hit the health-check function to see all key statuses at once:

```
GET https://<your-project-ref>.supabase.co/functions/v1/health
Authorization: Bearer <your-anon-key>
```

This returns a JSON object showing `apify_configured`, `youtube_configured`, `huggingface_configured` and other service statuses as `"ok"` or `"degraded"`.

---

## Cost Summary

| Service | Free Tier | Est. Production Cost |
|---------|-----------|----------------------|
| Apify | $5/month free credits (~500 enrichments) | $49/month Starter |
| YouTube Data API v3 | 10,000 units/day free (~97 enrichments/day) | Free (quota increase on request) |
| HuggingFace Inference API | Free tier with rate limits | $9/month PRO plan |
