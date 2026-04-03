/**
 * PrivacyPage.tsx  —  MUSHIN  ·  Complete Rewrite
 *
 * Replaces the 50-line InfluenceIQ-branded stub with a full,
 * structured Privacy Policy matching MUSHIN's dark design system.
 *
 * Changes vs. original:
 *  - Removed InfluenceIQ branding (Zap icon, "InfluenceIQ" text, aurora-text CSS)
 *  - Removed MarketingFooter + animated-mesh-bg (old system)
 *  - Uses shared LegalPageLayout (MUSHIN system)
 *  - Full legal content across 9 structured sections
 *  - Active section tracking in sidebar TOC
 *  - Mobile-first, no overflow issues
 */

import React from 'react';
import LegalPageLayout, { LegalSection } from '@/components/LegalPageLayout';

const sections: LegalSection[] = [
  {
    id: 'information-we-collect',
    title: '1. Information We Collect',
    content: (
      <>
        <p>
          We collect information you provide directly when you create an account, subscribe to a
          plan, or contact us for support. This includes your name, email address, company name,
          and billing details.
        </p>
        <p>
          We also collect usage data automatically: pages visited, features used, search queries
          submitted, and session duration. This data is collected via server logs and first-party
          analytics.
        </p>
        <p>
          If you connect third-party accounts (such as Instagram or Google), we receive only the
          data necessary to provide the requested integration — never your passwords.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use-your-data',
    title: '2. How We Use Your Data',
    content: (
      <>
        <p>We use the information we collect to:</p>
        <ul className="list-none space-y-2 mt-2">
          {[
            'Provide, operate, and improve the MUSHIN platform',
            'Process payments and manage your subscription',
            'Send transactional emails (receipts, password resets, product updates)',
            'Detect and prevent fraud and abuse',
            'Respond to support requests and inquiries',
            'Analyse aggregate usage trends to guide product development',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          We do not use your data for advertising profiling, and we do not sell your personal
          information to third parties under any circumstances.
        </p>
      </>
    ),
  },
  {
    id: 'creator-data',
    title: '3. Creator Profile Data',
    content: (
      <>
        <p>
          MUSHIN indexes publicly available creator profiles from Instagram, TikTok, and YouTube.
          This includes public handles, follower counts, engagement metrics, and content
          categories. None of this data is sourced through scraping in violation of platform
          terms.
        </p>
        <p>
          Creator profiles displayed on MUSHIN are derived from publicly accessible signals and
          our proprietary AI scoring models. Creators may request removal of their profile data
          by contacting <span className="text-purple-400">privacy@mushin.com</span>.
        </p>
      </>
    ),
  },
  {
    id: 'data-sharing',
    title: '4. Data Sharing',
    content: (
      <>
        <p>We share your data only in the following limited circumstances:</p>
        <ul className="list-none space-y-2 mt-2">
          {[
            'With payment processors (Stripe) to handle billing securely',
            'With transactional email providers (Resend / SendGrid) to deliver notifications',
            'With infrastructure providers (Supabase, Vercel) to operate the platform',
            'When required by law, regulation, or valid legal process',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          All third-party service providers are bound by data processing agreements and are
          prohibited from using your data for their own commercial purposes.
        </p>
      </>
    ),
  },
  {
    id: 'data-retention',
    title: '5. Data Retention',
    content: (
      <>
        <p>
          We retain your account data for as long as your account remains active. Billing records
          are retained for 7 years to comply with financial regulations. Server logs are purged
          after 90 days.
        </p>
        <p>
          If you delete your account, personal data is removed within 30 days. Anonymised,
          aggregated data (which cannot identify you) may be retained for longer to improve the
          platform.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: '6. Security',
    content: (
      <>
        <p>
          We implement industry-standard security measures to protect your data, including
          AES-256 encryption at rest, TLS 1.3 in transit, row-level security in our database,
          and regular third-party security reviews.
        </p>
        <p>
          Access to production systems is restricted to authorised personnel and is logged. We
          operate on the principle of least privilege — no team member has more access than their
          role requires.
        </p>
        <p>
          In the event of a data breach that affects your personal information, we will notify
          you within 72 hours as required by applicable law.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: '7. Your Rights',
    content: (
      <>
        <p>Depending on your location, you may have the right to:</p>
        <ul className="list-none space-y-2 mt-2">
          {[
            'Access the personal data we hold about you',
            'Correct inaccurate or incomplete data',
            'Request deletion of your account and personal data',
            'Export your data in a portable format',
            'Withdraw consent for optional data processing',
            'Lodge a complaint with your local data protection authority',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          To exercise any of these rights, email{' '}
          <span className="text-purple-400">privacy@mushin.com</span> with the subject line
          "Data Rights Request". We will respond within 30 days.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: '8. Cookies',
    content: (
      <>
        <p>
          We use essential cookies for authentication and session management, and first-party
          analytics cookies to understand platform usage. We do not use third-party advertising
          cookies or tracking pixels.
        </p>
        <p>
          For full details on the cookies we use and how to manage them, see our{' '}
          <a href="/cookies" className="text-purple-400 hover:text-purple-300 transition-colors underline underline-offset-2">
            Cookie Policy
          </a>.
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: '9. Changes to This Policy',
    content: (
      <>
        <p>
          We may update this Privacy Policy periodically to reflect changes in our practices or
          applicable law. When we make material changes, we will notify you by email and update
          the "Last updated" date at the top of this page.
        </p>
        <p>
          Your continued use of MUSHIN after any changes constitutes acceptance of the updated
          policy. If you disagree with the changes, you may delete your account at any time.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      badge="Legal"
      title="Privacy Policy"
      subtitle="We take your privacy seriously. Here's exactly what we collect, why we collect it, and how it's protected."
      lastUpdated="April 2026"
      sections={sections}
    />
  );
}
