

# Premium Landing Page Rebuild for InfluenceIQ

This plan replaces the current monolithic `LandingPage.tsx` with a modular, component-based marketing homepage that matches the Stripe/Linear/Vercel caliber described.

---

## Step 0: Revert Dashboard Changes

Before implementing, you need to restore `src/pages/Index.tsx` to its previous state (before the "Gold Standard Dashboard" rewrite). Use the **Restore** button in chat history on the message before that change.

---

## What Changes

The existing `LandingPage.tsx` is a single 313-line file with all sections inline. This rebuild:

1. Breaks it into 9 modular components under `src/components/marketing/`
2. Adds a true animated count-up counter (not just a fade)
3. Adds inline SVG hero visual (abstract network/node graphic)
4. Adds inline SVG feature icons (6 geometric illustrations)
5. Expands the footer to 4 columns with social icons
6. Adds the noise texture via the existing `AuroraBackground` component (already has it)
7. Adds a "How It Works" nav link and scroll targets
8. Polishes hover states with `will-change-transform` for 60fps

No new dependencies are needed. Everything uses existing framer-motion, lucide-react, and Tailwind.

---

## New Files

| File | Purpose |
|------|---------|
| `src/components/marketing/Hero.tsx` | Full-viewport hero with headline, CTAs, abstract SVG visual |
| `src/components/marketing/TrustSignals.tsx` | Logo cloud + animated count-up stat cards |
| `src/components/marketing/ProblemSolution.tsx` | Two-column problem vs. solution layout |
| `src/components/marketing/HowItWorks.tsx` | 3-step glass cards with step numbers |
| `src/components/marketing/Features.tsx` | 6-card grid with inline SVG icons |
| `src/components/marketing/PricingPreview.tsx` | 3 pricing cards from PLANS constant |
| `src/components/marketing/SecurityCompliance.tsx` | 4-item trust row (GDPR, Stripe, SOC2, Transparency) |
| `src/components/marketing/FinalCTA.tsx` | Gradient banner with CTA button |
| `src/components/marketing/MarketingFooter.tsx` | 4-column footer with social icons |

## Modified Files

| File | Change |
|------|--------|
| `src/pages/LandingPage.tsx` | Rewrite to import and compose the 9 marketing components. Keeps nav bar, aurora background, and auth-aware CTA logic. Drops all inline section code. |

---

## Component Details

### Hero.tsx
- Full viewport height (`min-h-screen`) with flex centering
- Headline: "Find **Real Influencers**. Instantly." with `text-5xl md:text-7xl font-extrabold tracking-tight`
- Aurora-text gradient on "Real Influencers"
- Sub-headline in `text-muted-foreground`
- Two CTAs: primary "Start Free" (`btn-shine`) and outline "See How It Works" (smooth scroll)
- Right side (desktop) or below (mobile): inline SVG abstract network graphic -- interconnected nodes with indigo/teal gradient strokes, animated with framer-motion float
- All entrance animations: staggered fade-up (0.6s)

### TrustSignals.tsx
- "Trusted by agencies & brands worldwide" label
- 6 placeholder brand wordmarks rendered as styled `<span>` elements at `opacity-40` (Velocity, Growth Co, Stellar, Nova, Apex, ScaleUp)
- 3 glass-card stat counters with **actual count-up animation** using `useInView` + `useMotionValue` + `useTransform` from framer-motion:
  - 10,000+ live searches
  - 99% fraud detection accuracy
  - 90% lower cost
- Numbers in `data-mono` (JetBrains Mono)

### ProblemSolution.tsx
- Section heading: "The Old Way vs. The InfluenceIQ Way"
- Two-column grid (stacks on mobile)
- Left column: 3 problem cards with red X icon and `border-destructive/20`
- Right column: 3 solution cards with green CheckCircle2 and `border-aurora-teal/30`
- Each card animates on scroll

### HowItWorks.tsx
- 3 glass cards side-by-side (`md:grid-cols-3`)
- Each has: step number in `data-mono`, icon in `aurora-gradient` circle, title, description
- Cards use `glass-card-hover` class for scale + border glow on hover
- Icons: Search, ShieldCheck, Mail from lucide-react

### Features.tsx
- Section heading: "Everything You Need to Win"
- 6-card grid (`sm:grid-cols-2 lg:grid-cols-3`)
- Each card has an inline SVG icon (simple geometric line-art, ~20 lines of SVG each):
  - Live Search: magnifying glass + globe paths
  - Fraud Detection: shield + check paths
  - Email Extraction: envelope + at-sign paths
  - Campaign Management: kanban columns paths
  - Outreach Automation: mail + rocket paths
  - Analytics: chart line paths
- SVGs use `stroke="currentColor"` with indigo accent class
- Cards use `glass-card-hover` with staggered entrance animation

### PricingPreview.tsx
- 3 cards from `PLANS` constant (Free, Pro $29/mo, Business $79/mo)
- Pro card has `ring-2 ring-primary` and "Most Popular" badge
- Each card lists: search credits, enrichment credits, campaigns, emails, AI insights, team members
- Prices in `data-mono` font
- CTA buttons: outline for Free/Business, `btn-shine` for Pro
- Hover: `will-change-transform` scale 1.02 + shadow increase

### SecurityCompliance.tsx
- 4 items in a row (was 3, adding SOC2-ready)
- Icons: Lock (GDPR), CreditCard (Stripe), Shield (SOC2), Eye (Transparency)
- Minimal glass cards

### FinalCTA.tsx
- Full-width `aurora-gradient` rounded section
- Headline: "Stop Guessing. Start Partnering with Real Creators."
- Large `btn-shine` CTA button
- Subtle framer-motion entrance

### MarketingFooter.tsx
- 4 columns: Brand (logo + tagline), Product (Features, Pricing, How It Works), Company (About, Blog, Careers), Legal (Privacy, Terms, Cookie Policy)
- Social icons row: Twitter, Linkedin, Github from lucide-react
- Copyright line
- Glass border styling

---

## LandingPage.tsx (Rewritten)

The page becomes a thin shell:

```text
- Force dark mode on mount
- Render fixed aurora background blobs
- Render fixed nav bar (unchanged)
- Compose: Hero, TrustSignals, ProblemSolution, HowItWorks, Features, PricingPreview, SecurityCompliance, FinalCTA, MarketingFooter
- Pass ctaPath and ctaLabel as props where needed
```

---

## Performance Specifications

- All hover effects use `will-change-transform` (GPU-composited)
- Animated counters use framer-motion `animate` (no setInterval)
- All sections use `whileInView` with `viewport={{ once: true }}` to animate only once
- Inline SVGs have explicit `width`/`height` attributes (no CLS)
- No external image loading -- all graphics are inline SVG
- Animation durations: entrance 0.4-0.6s, hover 0.2s, counters 1.5s

---

## No Image Files Needed

Instead of generating external image assets, all visuals are implemented as:
- **Inline SVGs** for the hero graphic and feature icons (zero network requests, zero CLS)
- **CSS-only** brand wordmarks (styled text spans)
- **Existing noise texture** already in `AuroraBackground` component (inline SVG data URI)

This eliminates the need for `/public/images/` files entirely and ensures optimal performance.

