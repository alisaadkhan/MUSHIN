

# Gold Standard SaaS Dashboard -- "Discover" Page

Replace the current `/dashboard` page (`src/pages/Index.tsx`) with an ultra-premium, enterprise-grade dashboard featuring a hero search bar and a glassmorphism data grid.

---

## Architecture

This is a single-file replacement of `src/pages/Index.tsx`. No new routes or dependencies are needed -- everything uses existing packages (framer-motion, lucide-react, Tailwind).

---

## Component Structure

The page is composed of inline sections (no new component files needed):

1. **Header** -- "Discover" title with fade-in, Filter button (outline), Export All button (primary with shimmer via existing `btn-shine` class)
2. **Hero Search Bar** -- Full-width input with `backdrop-blur-md`, `border-white/5`, focus glow via `ring` + `shadow-[0_0_20px_rgba(99,102,241,0.15)]` transition, inner shadow for depth
3. **Data Grid** -- Glass card container with a table showing mock influencer data

---

## Data

Use 8 hardcoded mock influencers matching the `Influencer` interface. Avatars use `https://api.dicebear.com/9.x/avataaars/svg?seed=USERNAME` for deterministic, lightweight SVG avatars.

```text
interface Influencer {
  id: string;
  username: string;
  platform: 'instagram' | 'tiktok' | 'youtube';
  followers: string;
  engagement: string;
  location: string;
  email: string | null;
  avatar: string;
}
```

---

## Visual Specifications

### Background
- The existing `AuroraBackground` component (already rendered by `AppLayout`) provides the aurora glows. No additional background divs needed -- the layout already has `#0a0a0a`-range charcoal via CSS variables.

### Search Bar
- Height: `h-14` with `px-5`
- Background: `bg-white/[0.03]` with `backdrop-blur-md`
- Border: `border-white/5`, on focus transitions to `border-indigo-500/50`
- Focus shadow: `shadow-[0_0_20px_rgba(99,102,241,0.15)]`
- Inner shadow: `shadow-inner` for depth
- Search icon left-aligned, keyboard shortcut hint right-aligned

### Data Table
- Wrapped in a glass card (`backdrop-blur-md bg-white/[0.02] border-white/5`)
- Fixed row height: `h-[72px]` to prevent CLS
- Columns: Influencer (avatar + name + location), Platform (colored pill), Audience (icon + number in JetBrains Mono), Engagement (green text, mono), Status (Enriched green pill / Pending amber pill), Actions (View button)
- Row hover: `hover:bg-white/[0.02]` with `transition-colors duration-150`
- Hardware-accelerated hover via `will-change-[background-color]` on rows

### Animations
- Title: `framer-motion` fade-in (0.3s)
- Search bar: fade-up (0.3s, 0.1s delay)
- Table rows: staggered fade-in (0.04s stagger, 0.2s duration each) using `framer-motion` variants
- Export button: existing `btn-shine` shimmer on hover

### Platform Badges
- Instagram: `bg-pink-500/10 text-pink-400 border-pink-500/20`
- TikTok: `bg-cyan-500/10 text-cyan-400 border-cyan-500/20`
- YouTube: `bg-red-500/10 text-red-400 border-red-500/20`

### Status Badges
- Enriched (email exists): `bg-emerald-500/10 text-emerald-400 border-emerald-500/20`
- Pending (email null): `bg-amber-500/10 text-amber-400 border-amber-500/20`

---

## Responsive Behavior

- On mobile (`< md`), the table scrolls horizontally inside `overflow-x-auto`
- Header buttons stack or shrink gracefully
- Search bar remains full-width

---

## Files

| Action | File | Detail |
|--------|------|--------|
| Rewrite | `src/pages/Index.tsx` | Complete replacement with the new dashboard UI |

No other files are modified. The routing (`/dashboard` rendering `Index`) and layout (`AppLayout` with sidebar + aurora background) remain unchanged.

---

## Technical Notes

- Zero new dependencies
- All hover effects use CSS `transition-colors` (GPU-composited) -- no JS-driven hover state
- `will-change-[background-color]` on table rows for 60fps hover
- Staggered row animations use framer-motion `variants` with `staggerChildren: 0.04` and `duration: 0.2`
- Avatar images are lightweight SVGs from DiceBear (no layout shift due to fixed `h-10 w-10` container)
- The existing hooks (`useWorkspaceCredits`, `useSearchHistory`, etc.) are removed from this page since it becomes a static showcase; real data integration can be layered back in later if needed

