# External API Keys & Configuration Required

## Required External Services

### 1. **Supabase Configuration** (`.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. **Cloudflare Turnstile (CAPTCHA)**
- **Purpose**: Bot protection for auth and forms
- **Env Variables**:
  ```env
  VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
  TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
  ```
- **Setup**: 
  1. Go to Cloudflare Dashboard → Turnstile
  2. Add new site with domain allowlist
  3. Copy site key and secret key

### 3. **Stripe (Payments)**
- **Purpose**: Subscription billing and payment processing
- **Env Variables**:
  ```env
  VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_PRO_PRICE_ID=price_...
  STRIPE_BUSINESS_PRICE_ID=price_...
  ```
- **Setup**:
  1. Create Stripe account
  2. Create products for Pro and Business plans
  3. Set up webhook endpoint: `https://your-domain.com/functions/v1/stripe-webhook`
  4. Configure webhook events: `checkout.session.completed`, `customer.subscription.updated`, `invoice.paid`, `payment.failed`

### 4. **YouTube Data API v3**
- **Purpose**: YouTube creator profile enrichment
- **Env Variables**:
  ```env
  YOUTUBE_API_KEY=AIzaSy...
  ```
- **Setup**:
  1. Google Cloud Console → APIs & Services
  2. Enable YouTube Data API v3
  3. Create credentials (API Key)
  4. Quota: 10,000 units/day free tier

### 5. **Upstash Redis**
- **Purpose**: Rate limiting and caching
- **Env Variables**:
  ```env
  UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
  UPSTASH_REDIS_REST_TOKEN=your-redis-token
  ```
- **Setup**:
  1. Create Upstash account
  2. Create Redis database
  3. Copy REST URL and token
  4. Free tier: 10,000 commands/day

### 6. **OpenAI API (Embeddings)**
- **Purpose**: Creator similarity search, niche classification
- **Env Variables**:
  ```env
  OPENAI_API_KEY=sk-...
  ```
- **Setup**:
  1. OpenAI Platform → API Keys
  2. Create new secret key
  3. Used for: `text-embedding-ada-002` (1536 dimensions)
  4. Cost: ~$0.0001 per 1K tokens

### 7. **Groq API (LLM Fallback)**
- **Purpose**: AI insights, creator narratives (alternative to OpenAI)
- **Env Variables**:
  ```env
  GROQ_API_KEY=gsk_...
  ```
- **Setup**:
  1. Groq Cloud Console
  2. Create API key
  3. Free tier: 14,400 requests/day (Llama 3.3 70B)

### 8. **Apify (Instagram/TikTok Scraping)**
- **Purpose**: Social media profile data extraction
- **Env Variables**:
  ```env
  APIFY_API_TOKEN=...
  ```
- **Setup**:
  1. Apify Console → Settings → API Tokens
  2. Create new token
  3. Used for: Instagram/TikTok data when official APIs unavailable
  4. Cost: Paid plans start at $49/month

### 9. **PostHog (Analytics)**
- **Purpose**: Product analytics, event tracking
- **Env Variables**:
  ```env
  VITE_POSTHOG_KEY=phc_...
  VITE_POSTHOG_HOST=https://app.posthog.com
  ```
- **Setup**:
  1. PostHog Project Settings → API Keys
  2. Copy Project API Key
  3. Free tier: 1M events/month

### 10. **Sentry (Error Tracking)**
- **Purpose**: Error monitoring and crash reporting
- **Env Variables**:
  ```env
  VITE_SENTRY_DSN=https://...@sentry.io/...
  SENTRY_AUTH_TOKEN=...
  ```
- **Setup**:
  1. Sentry Project Settings → Keys
  2. Copy DSN
  3. Create auth token for source maps
  4. Free tier: 5K errors/month

### 11. **Resend (Email Sending)**
- **Purpose**: Transactional emails (password reset, verification, outreach)
- **Env Variables**:
  ```env
  RESEND_API_KEY=re_...
  FROM_EMAIL=noreply@yourdomain.com
  ```
- **Setup**:
  1. Resend Dashboard → API Keys
  2. Add and verify domain
  3. Free tier: 100 emails/day, 3,000 emails/month

### 12. **Hugging Face Inference API** (Optional)
- **Purpose**: ML model inference for bot detection
- **Env Variables**:
  ```env
  HUGGINGFACE_TOKEN=hf_...
  ```
- **Setup**:
  1. Hugging Face Settings → Access Tokens
  2. Create new token with "read" permissions
  3. Free tier available with rate limits

---

## Supabase Edge Functions Configuration

### Environment Variables for Edge Functions
Create/update `supabase/functions/_shared/secrets.ts`:

```typescript
export const SECRETS = {
  YOUTUBE_API_KEY: Deno.env.get("YOUTUBE_API_KEY"),
  OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY"),
  GROQ_API_KEY: Deno.env.get("GROQ_API_KEY"),
  APIFY_API_TOKEN: Deno.env.get("APIFY_API_TOKEN"),
  STRIPE_SECRET_KEY: Deno.env.get("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: Deno.env.get("STRIPE_WEBHOOK_SECRET"),
  UPSTASH_REDIS_REST_URL: Deno.env.get("UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: Deno.env.get("UPSTASH_REDIS_REST_TOKEN"),
  RESEND_API_KEY: Deno.env.get("RESEND_API_KEY"),
  HUGGINGFACE_TOKEN: Deno.env.get("HUGGINGFACE_TOKEN"),
};
```

### Set Secrets in Supabase
```bash
# For each secret, run:
supabase secrets set YOUTUBE_API_KEY=your-key
supabase secrets set OPENAI_API_KEY=your-key
supabase secrets set GROQ_API_KEY=your-key
supabase secrets set APIFY_API_TOKEN=your-token
supabase secrets set STRIPE_SECRET_KEY=your-key
supabase secrets set STRIPE_WEBHOOK_SECRET=your-webhook-secret
supabase secrets set UPSTASH_REDIS_REST_URL=your-url
supabase secrets set UPSTASH_REDIS_REST_TOKEN=your-token
supabase secrets set RESEND_API_KEY=your-key
```

---

## Database Schema Requirements

### Support Staff Role
Add to `user_roles` table:
```sql
-- Support staff role
INSERT INTO user_roles (user_id, role)
VALUES ('user-uuid-here', 'support');
```

### Required Permissions for Support Role
```sql
-- Support can view users, tickets, but not modify critical settings
GRANT SELECT ON profiles TO support;
GRANT SELECT, UPDATE ON support_tickets TO support;
GRANT SELECT, INSERT ON support_ticket_replies TO support;
GRANT SELECT ON workspace_members TO support;
```

---

## Payment Gateway Setup (Stripe)

### 1. Create Products in Stripe Dashboard
```
Product: MUSHIN Pro
- Price: $29/month (or PKR 4,999/month)
- Price ID: price_1T0PsPDuoE2xHHDKCp789YjT

Product: MUSHIN Business  
- Price: $79/month (or PKR 14,999/month)
- Price ID: price_1T0PsbDuoE2xHHDK3QSI8RTe
```

### 2. Configure Checkout Session
Update `supabase/functions/create-checkout/index.ts`:
```typescript
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items: [
    {
      price: plan === "pro" ? 
        Deno.env.get("STRIPE_PRO_PRICE_ID") : 
        Deno.env.get("STRIPE_BUSINESS_PRICE_ID"),
      quantity: 1,
    },
  ],
  success_url: `${origin}/billing?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/billing`,
});
```

### 3. Webhook Handler
Edge function `stripe-webhook` already exists. Ensure it handles:
- `checkout.session.completed` → Activate subscription
- `customer.subscription.updated` → Update plan
- `invoice.paid` → Log payment
- `payment.failed` → Notify user, suspend if repeated

---

## Google OAuth Setup

### Google Cloud Console
1. Enable Google+ API
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `https://your-domain.com/auth/v1/callback`
   - `https://your-project.supabase.co/auth/v1/callback`
4. Configure domain allowlist in `check_email_allowed` RPC to block consumer domains

---

## Testing Checklist

### Before Going Live:
- [ ] All API keys set in `.env` and Supabase secrets
- [ ] Stripe webhook endpoint verified
- [ ] Email domain verification (Resend)
- [ ] Turnstile CAPTCHA working on login/signup
- [ ] YouTube API quota sufficient
- [ ] Rate limiting configured (Upstash)
- [ ] Support staff account created with proper role
- [ ] Admin users have `admin` or `super_admin` role
- [ ] Payment flow tested end-to-end
- [ ] Email verification flow working
- [ ] Password reset flow working
- [ ] Mobile responsiveness verified (especially Atom Orbit)

---

## Cost Estimation (Monthly)

| Service | Free Tier | Paid Tier (Est.) |
|---------|-----------|------------------|
| Supabase | Free up to 500MB DB | $25/mo (Pro) |
| Stripe | No monthly fee | 2.9% + $0.30 per transaction |
| YouTube API | 10K units/day | $0 (within quota) |
| Upstash Redis | 10K commands/day | $10/mo if exceeded |
| OpenAI | - | ~$5-20/mo (embeddings) |
| Groq | 14.4K req/day | $0 (free tier sufficient) |
| Apify | - | $49/mo (if needed) |
| Resend | 3K emails/mo | $20/mo if exceeded |
| PostHog | 1M events/mo | $0 (free tier) |
| Sentry | 5K errors/mo | $0 (free tier) |
| Cloudflare Turnstile | Free | $0 |

**Total Estimated Monthly Cost**: $0-150/mo depending on usage

---

## Security Notes

1. **Never commit `.env` files** to Git
2. **Rotate API keys** every 90 days
3. **Use Supabase RLS** (Row Level Security) on all tables
4. **Enable 2FA** for all admin and support accounts
5. **Monitor webhook signatures** - verify HMAC on all Stripe webhooks
6. **Rate limit all edge functions** using Upstash
7. **CORS configuration** - restrict to your domain only
8. **Audit logs** - all admin actions logged to `admin_audit_log`

---

## Next Steps

1. Create all API accounts listed above
2. Add keys to `.env` (local) and Supabase secrets (production)
3. Test each integration individually
4. Run full E2E test suite: `npm run test:e2e`
5. Deploy to production
6. Monitor Sentry dashboard for errors
7. Review PostHog analytics for user behavior
