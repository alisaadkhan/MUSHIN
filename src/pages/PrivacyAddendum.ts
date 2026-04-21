/**
 * MUSHIN — Privacy Policy (Updated)
 * 
 * CHANGES FROM PREVIOUS VERSION:
 * - Added Section 5: Third-Party Analytics & Monitoring Disclosure
 * - Added explicit PostHog, Sentry, Vercel disclosure
 * - Added opt-out instructions
 * - Added sub-processor list reference
 * 
 * DROP THIS INTO: src/pages/PrivacyPage.tsx (merge with existing LegalPageLayout)
 */

// ── Section to INSERT into your existing PrivacyPage ──────────

export const ANALYTICS_DISCLOSURE_SECTION = {
  title: "Analytics & Monitoring Services",
  content: `
We use the following third-party services to operate, monitor, and improve MUSHIN.
Each service processes data as described below. By using MUSHIN, you acknowledge
these integrations. EU/EEA users may opt out where indicated.

**PostHog (Product Analytics)**
We use PostHog to understand how users interact with MUSHIN — page views, feature
usage, session recordings, and funnel analysis. PostHog processes: pages visited,
actions taken, browser/device type, IP address (anonymised), and session duration.
Data is stored on PostHog-controlled infrastructure. You may opt out via our
Cookie Preferences panel or by sending a request to privacy@mushin.app.
PostHog Privacy Policy: https://posthog.com/privacy

**Sentry (Error Monitoring)**
We use Sentry to capture and diagnose application errors and performance issues.
Sentry processes: browser type, OS, page URL, stack traces, and (where applicable)
breadcrumbs of recent user actions. Personally identifiable data is scrubbed before
transmission where possible. Sentry Privacy Policy: https://sentry.io/privacy

**Vercel Analytics & Speed Insights (Web Performance)**
We use Vercel's built-in analytics to measure Core Web Vitals and aggregate page
performance. Vercel Analytics does not use cookies and does not track individuals.
Data collected is aggregated and anonymised. Vercel Privacy Policy: https://vercel.com/legal/privacy-policy

**Cloudflare Turnstile (Bot Protection)**
Sign-up and sign-in forms use Cloudflare Turnstile to prevent automated abuse.
Turnstile may analyse browser characteristics to distinguish humans from bots.
No persistent tracking occurs. Cloudflare Privacy Policy: https://www.cloudflare.com/privacypolicy

**Supabase (Infrastructure)**
All application data — user accounts, workspace data, search history — is stored
on Supabase-managed PostgreSQL databases hosted in the EU region (Frankfurt).
Supabase processes data solely as a data processor under our Data Processing Agreement.
Supabase Privacy Policy: https://supabase.com/privacy

**Paddle (Payment Processing)**
Billing, subscription management, and payment processing is handled by Paddle.com
Market Limited. Paddle acts as a Merchant of Record and processes payment data
independently. MUSHIN does not store payment card information.
Paddle Privacy Policy: https://www.paddle.com/legal/privacy

---

**Your Choices**

- **Opt out of PostHog:** Click "Cookie Preferences" in the app footer
- **Data export:** Email privacy@mushin.app to receive a copy of your personal data
- **Data deletion:** Email privacy@mushin.app to request account and data deletion (GDPR Art. 17)
- **Withdraw consent:** You may withdraw analytics consent at any time; withdrawal does not affect prior processing

EU/EEA residents have additional rights under GDPR including the right to lodge a complaint
with your national supervisory authority.
  `.trim(),
};

// ── GDPR Sub-processor List (for DPA page) ─────────────────────

export const SUB_PROCESSORS = [
  {
    name:     'Supabase, Inc.',
    purpose:  'Database, authentication, file storage',
    location: 'EU (Frankfurt, Germany)',
    link:     'https://supabase.com/privacy',
  },
  {
    name:     'Paddle.com Market Limited',
    purpose:  'Payment processing, subscription management',
    location: 'United Kingdom / Global',
    link:     'https://www.paddle.com/legal/privacy',
  },
  {
    name:     'PostHog, Inc.',
    purpose:  'Product analytics',
    location: 'United States (EU-hosted option available)',
    link:     'https://posthog.com/privacy',
  },
  {
    name:     'Functional Software, Inc. (Sentry)',
    purpose:  'Error monitoring',
    location: 'United States',
    link:     'https://sentry.io/privacy',
  },
  {
    name:     'Vercel, Inc.',
    purpose:  'Hosting, CDN, performance analytics',
    location: 'United States',
    link:     'https://vercel.com/legal/privacy-policy',
  },
  {
    name:     'Cloudflare, Inc.',
    purpose:  'Bot protection (Turnstile)',
    location: 'United States',
    link:     'https://www.cloudflare.com/privacypolicy',
  },
];
