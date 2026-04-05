# MUSHIN — Full System Fix Plan

## Phase 1: Critical Bug Fixes (C1-C6)

### C1: Fix `use-toast.ts` listener re-subscription loop
**File:** `src/hooks/use-toast.ts:177`
**Problem:** `useEffect` has `[state]` in dependency array, causing re-subscribe on every toast state change → O(n²) listener churn.
**Fix:**
```ts
// Line 177: change [state] to []
React.useEffect(() => {
  listeners.push(setState);
  return () => {
    const index = listeners.indexOf(setState);
    if (index > -1) listeners.splice(index, 1);
  };
}, []); // ← empty deps: setState is stable
```

### C2: Fix `useInfluencerEvaluation` non-existent DB columns
**File:** `src/hooks/useInfluencerEvaluation.ts:41-42, 96-97`
**Problem:** Queries `evaluation_version` and `expires_at` columns that don't exist in `influencer_evaluations` table.
**Fix:** Remove the non-existent column filters from cache check and upsert:
```ts
// fetchCached (lines 41-42): remove these two lines
// .eq("evaluation_version", 1)
// .gt("expires_at", new Date().toISOString())

// getCachedScore (lines 121-122): same removal
// .eq("evaluation_version", 1)
// .gt("expires_at", new Date().toISOString())

// upsert (lines 96-97): remove these fields from payload
// expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
// evaluation_version: 1,
```

### C3: XSS via dangerouslySetInnerHTML — FALSE POSITIVE
**File:** `src/components/campaigns/EmailTemplateManager.tsx`
**Finding:** The component does NOT use `dangerouslySetInnerHTML`. Template bodies are rendered via controlled `<Textarea>` and `<Input>` elements. No fix needed.

### C4: Fix missing `notifications` table handling
**File:** `src/hooks/useNotifications.ts:25`
**Problem:** Queries `notifications` table which may not exist in schema.
**Fix:** Add graceful error handling so the app doesn't crash if table is missing:
```ts
queryFn: async () => {
  if (!user) throw new Error("No user");
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    if (error.code === "42P01") return []; // table doesn't exist — return empty
    throw error;
  }
  return data as Notification[];
},
```

### C5: Fix missing `support_tickets` table handling
**File:** `src/pages/SupportPage.tsx:77-78, 108`
**Problem:** Queries `support_tickets` and `support_ticket_replies` tables which may not exist.
**Fix:** Add graceful error handling:
```ts
// In both ticket and reply queryFns:
if (error) {
  if (error.code === "42P01") return []; // table doesn't exist
  throw error;
}
```

### C6: Fix `Onboarding.tsx` null profile crash
**File:** `src/pages/Onboarding.tsx:42-43`
**Problem:** `profile!.id` throws TypeError if profile is null during async operation.
**Fix:**
```ts
const handleComplete = async () => {
  if (!fullName.trim()) {
    toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
    setStep(1);
    return;
  }
  if (!profile?.id) {
    toast({ title: "Profile not ready", description: "Please wait a moment and try again.", variant: "destructive" });
    return;
  }
  setSaving(true);
  try {
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), onboarding_completed: true, consent_given_at: new Date().toISOString() })
      .eq("id", profile.id); // no more ! assertion
```

---

## Phase 2: High-Impact Bugs (H1-H13)

### H1: Fix `updateCampaign` mutation shape mismatch
**Files:** `src/hooks/useCampaigns.ts:40`, `src/pages/CampaignDetailPage.tsx:103,215`
**Problem:** MutationFn expects `{ id, values }` but callers pass flat object.
**Fix in `useCampaigns.ts`:**
```ts
mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
  const { data, error } = await supabase
    .from("campaigns")
    .update(values)
    .eq("id", id)
    .select()
    .single();
  // ...
}
```
**Fix in `CampaignDetailPage.tsx:103-108`:**
```ts
await updateCampaign.mutateAsync({
  id,
  name: editName.trim(),
  description: editDescription.trim(),
  budget: editBudget ? Number(editBudget) : null,
  start_date: editStartDate || null,
  end_date: editEndDate || null,
});
```

### H2: Fix `handleAddToList` non-existent `profile_id` column
**File:** `src/pages/InfluencerProfilePage.tsx:366`
**Problem:** `list_items` table has no `profile_id` column.
**Fix:** Remove `profile_id: profile.id` from the insert object.

### H3: Fix `BillingPage` non-existent `payments` table
**File:** `src/pages/BillingPage.tsx:42-48`
**Fix:** Wrap query in try/catch and return empty array if table doesn't exist:
```ts
if (error) {
  if (error.code === "42P01") return []; // table doesn't exist
  throw error;
}
```

### H4: Fix `AnalyticsPage` non-existent `campaign_metrics` table
**File:** `src/pages/AnalyticsPage.tsx:61-66`
**Fix:** Same pattern — check for error code `42P01` (undefined_table).

### H5: Fix open redirect via notification links
**File:** `src/components/NotificationCenter.tsx:24-29`
**Fix:**
```ts
const ALLOWED_EXTERNAL_DOMAINS = ['stripe.com', 'mushin.com', 'mushin.ai'];
if (link.startsWith("http")) {
  const url = new URL(link);
  if (!ALLOWED_EXTERNAL_DOMAINS.some(d => url.hostname.endsWith(d))) {
    console.warn("Blocked untrusted notification link:", link);
    return;
  }
  window.open(link, "_blank", "noopener,noreferrer");
}
```

### H6: Add server-side admin re-verification
**File:** `src/components/admin/AdminRoute.tsx:24`
**Fix:** The frontend check is fine as UX, but document that ALL admin edge functions must verify admin role server-side via the `privileged_gateway` module. Add a comment:
```tsx
// NOTE: This is a UX-level check. All admin edge functions MUST
// verify admin role server-side via performPrivilegedWrite/Read.
// If RLS is misconfigured, this client-side check can be bypassed.
```

### H7: Extract `SearchPage.tsx` sub-components
**File:** `src/pages/SearchPage.tsx` (1158 lines)
**Extract to:**
- `src/components/search/FilterPanel.tsx`
- `src/components/search/ResultCard.tsx`
- `src/components/search/SearchBar.tsx`
- `src/components/search/CreditsDialog.tsx`
- `src/components/search/SaveSearchDialog.tsx`

### H8: Lazy-load `LandingPage`
**File:** `src/App.tsx:14`
**Fix:**
```ts
const LandingPage = lazy(() => import("./pages/LandingPage"));
```

### H9: Memoize `ResultCard`
**File:** `src/pages/SearchPage.tsx:862`
**Fix:**
```tsx
const ResultCard = React.memo(function ResultCard({ result, isFreePlan, lists, ... }: ResultCardProps) { ... });
```

### H10: Parallel queries in `useInfluencerProfile`
**File:** `src/hooks/useInfluencerProfile.ts:121-148`
**Fix:** Run both `influencer_profiles` and `influencers_cache` queries with `Promise.all`:
```ts
const [profileRes, cacheRes] = await Promise.all([
  supabase.from("influencer_profiles").select("*").in("username", bothVariants(username)).limit(1).maybeSingle(),
  supabase.from("influencers_cache").select("*").in("username", bothVariants(username)).limit(1).maybeSingle(),
]);
```

### H11: Fix AnalyticsPage unbounded queries
**File:** `src/pages/AnalyticsPage.tsx:16-25, 29-40`
**Fix:** Add date range filter and limits:
```ts
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
// For credits_usage:
.gte("created_at", thirtyDaysAgo)
.limit(500)
// For campaigns: only select needed fields, not full nested pipeline data
```

### H12: Fix bulk fraud check sequential AI calls
**File:** `src/components/campaigns/KanbanBoard.tsx:304-339`
**Fix:** Use concurrency-limited `Promise.allSettled`:
```ts
const concurrencyLimit = 3;
for (let i = 0; i < stageCards.length; i += concurrencyLimit) {
  const chunk = stageCards.slice(i, i + concurrencyLimit);
  await Promise.allSettled(chunk.map(card => runFraudCheck(card)));
}
```

### H13: Fix saved search/history rerun param name mismatch
**Files:** `src/pages/SavedSearchesPage.tsx:39`, `src/pages/HistoryPage.tsx:96`
**Fix:** Change `"location"` to `"city"` in both files:
```ts
params.set("city", filters.location); // was "location"
```

---

## Phase 3: Security Hardening

### S1: Sanitize URL parameters in SearchPage
**File:** `src/pages/SearchPage.tsx:245-252`
**Fix:**
```ts
const sanitizeInput = (input: string | null, maxLength: number = 200): string => {
  if (!input) return "";
  return input.replace(/[<>]/g, "").slice(0, maxLength);
};
const [query, setQuery] = useState(sanitizeInput(searchParams.get("q")));
```

### S2: Add input validation on campaign creation
**File:** `src/hooks/useCampaigns.ts:26-35`
**Fix:**
```ts
if (!values.name || values.name.length > 200) throw new Error("Invalid campaign name");
if (values.budget !== undefined && (values.budget < 0 || values.budget > 1_000_000)) throw new Error("Invalid budget");
```

### S3: Fix webhook SSRF — add missing private IP ranges
**File:** `src/lib/integrations.ts:47-66`
**Fix:**
```ts
const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
];
```

### S4: Standardize password policy to 8 chars minimum
**Files:** `src/pages/Auth.tsx`, `src/pages/UpdatePassword.tsx:26`, `src/pages/Settings.tsx:161`
**Fix:** Change all to `password.length < 8`.

### S5: Fix CSV export formula injection + quote escaping
**Files:** `src/pages/ListDetailPage.tsx:172`, `src/pages/CampaignComparePage.tsx:69`
**Fix:**
```ts
const sanitizeCsvCell = (c: string) => {
  if (/^[=+\-@]/.test(c)) return "'" + c;
  return c.replace(/"/g, '""');
};
const csv = [headers, ...rows].map((r) => r.map(c => `"${sanitizeCsvCell(c)}"`).join(",")).join("\n");
```

### S6: Add `noopener,noreferrer` to all `window.open` calls
**Files:** `src/hooks/useSubscription.ts:44,51`
**Fix:**
```ts
window.open(data.url, "_blank", "noopener,noreferrer");
```

### S7: Map Supabase error messages to user-friendly messages
**Files:** `src/pages/Auth.tsx:88`, `src/pages/UpdatePassword.tsx:33`, `src/pages/Settings.tsx:173`
**Fix:**
```ts
const getAuthErrorMessage = (error: Error): string => {
  if (error.message.includes("Invalid login credentials")) return "Invalid email or password";
  if (error.message.includes("Email not confirmed")) return "Please verify your email first";
  return "Authentication failed. Please try again.";
};
```

---

## Phase 4: Performance Improvements

### P1: Add `staleTime` to all React Query hooks
**Files:** `useCampaigns.ts`, `useSearchHistory.ts`, `useOutreachLog.ts`, `useEmailTemplates.ts`, `useSavedSearches.ts`, `useInfluencerLists.ts`
**Fix:** Add `staleTime: 5 * 60_000` (5 min) to all queries that fetch rarely-changing data.

### P2: Fix notification polling when popover is closed
**File:** `src/hooks/useNotifications.ts:35`
**Fix:** Add `refetchInterval` conditional or use Supabase Realtime subscriptions instead of polling.

### P3: Fix sidebar credits widget division by zero
**File:** `src/components/layout/AppSidebar.tsx:58`
**Fix:**
```ts
const pct = maxCredits === 0 ? 0 : Math.min((totalCredits / maxCredits) * 100, 100);
```

### P4: Fix `useScrollVideoScrub` division by zero
**File:** `src/hooks/useScrollVideoScrub.ts:85`
**Fix:**
```ts
const total = container.offsetHeight - window.innerHeight;
if (total <= 0) return;
const progress = Math.min(Math.max(-rect.top / total, 0), 1);
```

### P5: Fix KanbanBoard `filteredCardsByStage` called inside render loop
**File:** `src/components/campaigns/KanbanBoard.tsx:418`
**Fix:** Pre-compute with `useMemo`:
```ts
const cardsByStage = useMemo(() => {
  const map = new Map<string, typeof cards>();
  stages?.forEach(s => {
    let stageCards = cards?.filter(c => c.stage_id === s.id) || [];
    // ... filtering logic
    map.set(s.id, stageCards);
  });
  return map;
}, [stages, cards, searchQuery, platformFilters]);
```

### P6: Fix `handleSearch` stale closure in auto-search effect
**File:** `src/pages/SearchPage.tsx:297-319, 321`
**Fix:** Wrap `handleSearch` in `useCallback` with all state dependencies, or use refs.

### P7: Fix `AnalyticsPage` stages.sort mutation
**File:** `src/pages/AnalyticsPage.tsx:94`
**Fix:**
```ts
const lastStage = [...stages].sort((a, b) => b.position - a.position)[0];
```

### P8: Fix toastTimeouts Map memory leak
**File:** `src/hooks/use-toast.ts:53`
**Fix:** Clear timeout from map on dismiss:
```ts
const dismiss = () => {
  const timeout = toastTimeouts.get(id);
  if (timeout) { clearTimeout(timeout); toastTimeouts.delete(id); }
  dispatch({ type: "DISMISS_TOAST", toastId: id });
};
```

---

## Phase 5: UI/UX Polish

### U1: Convert `SearchPage.tsx` inline styles to Tailwind
**File:** `src/pages/Index.tsx:9-11,85-167`
**Fix:** Replace the `S` style object and inline `style={}` props with Tailwind utility classes.

### U2: Fix micro-text below accessibility minimum (9px → 10px+)
**Files:** `AppSidebar.tsx:75,97`, `SearchPage.tsx:577,597`, `InfluencerProfilePage.tsx:125,129`
**Fix:** Change all `text-[9px]` to `text-[10px]` minimum.

### U3: Add missing `aria-label` on search inputs and filter selects
**Files:** `AppLayout.tsx:69-81`, `SearchPage.tsx:117-123, 129-135`
**Fix:** Add `aria-label` attributes to all form inputs without labels.

### U4: Fix color-only status indicators (add icons)
**Files:** `AdminDashboard.tsx:79-81`, `SearchPage.tsx:1082-1103`
**Fix:** Add checkmark/warning icons alongside color dots.

### U5: Fix card styling fragmentation → create `<Card>` component
**Fix:** Create a shared `<Card>` component with the most-used pattern:
```tsx
// src/components/ui/card-standard.tsx
export function CardStandard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5 ${className || ""}`}>
      {children}
    </div>
  );
}
```

### U6: Add loading/empty/error states to AnalyticsPage, AdminDashboard, Settings
**Files:** `AnalyticsPage.tsx`, `AdminDashboard.tsx`, `Settings.tsx`
**Fix:** Add skeleton placeholders during loading states.

### U7: Fix duplicate `border border-primary/20` in AppSidebar
**File:** `src/components/layout/AppSidebar.tsx:83`
**Fix:** Remove the duplicate class.

### U8: Fix scrollbar width (3px → 6px)
**File:** `src/index.css:212-214`
**Fix:** Change `width: 3px; height: 3px;` to `width: 6px; height: 6px;`.

### U9: Add skip-to-content link
**File:** `src/components/layout/AppLayout.tsx`
**Fix:** Add as first element:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md">
  Skip to content
</a>
```

### U10: Standardize date formatting
**Fix:** Create `<RelativeTime>` component using `date-fns` `formatDistanceToNow` for recent dates and `format` for older ones.

### U11: Add `PageHeader` component
**Fix:**
```tsx
export function PageHeader({ title, subtitle, icon: Icon }: { title: string; subtitle?: string; icon?: React.ElementType }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
        {Icon && <Icon className="text-primary" size={26} />}
        {title}
      </h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
```

### U12: Add `EmptyState` component
**Fix:**
```tsx
export function EmptyState({ icon: Icon, title, description, action }: { icon: React.ElementType; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {action}
    </div>
  );
}
```

---

## Phase 6: Code Quality

### Q1: Enable `strictNullChecks: true` in tsconfig
**File:** `tsconfig.app.json:19`
**Fix:** Change `"strict": false` to `"strict": true`, then fix all resulting type errors incrementally.

### Q2: Replace `any` types with proper interfaces
**Files:** `useInfluencerProfile.ts`, `useInfluencerEvaluation.ts`, `useAIInsights.ts`, `InfluencerProfilePage.tsx`, `SearchPage.tsx`, `Settings.tsx`
**Fix:** Define proper intermediate types and use type guards.

### Q3: Extract duplicated utilities
- `formatFollowers` → `src/lib/formatFollowers.ts`
- `trigramSimilarity` / `buildTrigrams` → `src/lib/similarity.ts`
- `PlatformIcon` → `src/components/common/PlatformIcon.tsx`

### Q4: Enable `noUnusedLocals` and `noUnusedParameters`
**Files:** `tsconfig.app.json:20-21`, `eslint.config.js:29`
**Fix:** Enable both and clean up dead code.

### Q5: Remove unnecessary `import React` statements
**Fix:** With `jsx: "react-jsx"`, bare `import React` is unnecessary. Remove from files that don't use `React.` prefix.

### Q6: Add JSDoc to all public hook exports
**Fix:** Add JSDoc comments to each exported hook describing purpose, return values, and error behavior.

### Q7: Fix `err: any` → `err: unknown` pattern everywhere
**Fix:**
```ts
// Before
catch (err: any) {
  toast({ title: "Error", description: err.message });
}

// After
catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  toast({ title: "Error", description: message });
}
```

### Q8: Create `showErrorToast` utility
**File:** `src/lib/toast.ts`
**Fix:**
```ts
export function showErrorToast(err: unknown, fallbackTitle = "Error") {
  const message = err instanceof Error ? err.message : "Something went wrong";
  toast({ title: fallbackTitle, description: message, variant: "destructive" });
}
```

### Q9: Fix module naming inconsistencies
- Rename `src/modules/campaign/` → `src/modules/campaign-intelligence/`
- Rename `src/modules/platform/` → `src/modules/platform-core/` or merge into `platforms/`

### Q10: Standardize `catch` blocks — no silent swallowing
**Files:** `SearchPage.tsx:315,399,431`, `InfluencerProfilePage.tsx:507,76`
**Fix:**
```ts
// Before
.catch(() => { })

// After
.catch((err) => {
  if (import.meta.env.DEV) console.warn("[module] operation failed:", err);
})
```

---

## Summary of All Changes

| Phase | Files to Modify | Estimated Changes |
|---|---|---|
| Phase 1: Critical | 5 files | 6 fixes |
| Phase 2: High-Impact | 13 files | 13 fixes |
| Phase 3: Security | 7 files | 7 fixes |
| Phase 4: Performance | 8 files | 8 fixes |
| Phase 5: UI/UX | 10 files + 3 new components | 12 fixes |
| Phase 6: Code Quality | 15+ files + 3 new utilities | 10 fixes |
| **Total** | **~50 files** | **~56 fixes** |
