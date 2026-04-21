// ============================================================
// SearchDashboard.tsx — Live Backend Edition
//
// Changes from mock version:
//   • Imports Supabase client (not mock data)
//   • Calls discover-creators edge function with filter debounce
//   • Three render states: loading (skeletons), error, results
//   • Source indicator: "cache" vs "live" in the top bar
//   • Timing display in dev mode
//   • All existing UI (MUSHINScore, EnrichmentBadges, etc.) unchanged
// ============================================================

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { supabase } from "../../integrations/supabase/client"; // adjust path as needed
import { DEFAULT_FILTERS } from "../types/creator";
import type { SearchFilters, Creator } from "../types/creator";
import { SearchSidebar } from "../components/search/SearchSidebar";
import { CreatorCard } from "../components/search/CreatorCard";
import { CreatorCardSkeletonGrid } from "../components/search/CreatorCardSkeleton";

// ── Types ─────────────────────────────────────────────────────
type DataSource  = "cache" | "live" | "cache_stale" | null;
type LoadState   = "idle" | "loading" | "error" | "success";

interface EdgeFunctionResponse {
  creators:  Creator[];
  source:    DataSource;
  count:     number;
  warning?:  string;
  timing?: {
    total_ms:   number;
    cache_ms?:  number;
    serper_ms?: number;
    apify_ms?:  number;
  };
}

// ── Sort options ──────────────────────────────────────────────
type SortKey = "mushin_score" | "followers" | "engagement_rate" | "growth_rate_30d";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "mushin_score",    label: "MUSHIN Score" },
  { key: "followers",       label: "Followers"    },
  { key: "engagement_rate", label: "Engagement"   },
  { key: "growth_rate_30d", label: "Growth"       },
];

// ── Debounce hook ─────────────────────────────────────────────
function useDebounce<T>(value: T, delay = 600): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Normalise DB row → Creator type ──────────────────────────
// The DB uses snake_case; the frontend types use camelCase.
function normaliseCreator(row: Record<string, unknown>): Creator {
  const m = row as any;
  return {
    id:                m.id,
    handle:            m.handle,
    displayName:       m.display_name ?? m.handle,
    avatarGradient:    "linear-gradient(135deg, #4b5563, #374151)", // fallback
    initials:          (m.display_name ?? m.handle ?? "?").slice(0, 2).toUpperCase(),
    city:              m.city ?? "Pakistan",
    niches:            m.niches ?? [],
    followers:         m.followers ?? 0,
    followingCount:    m.following_count ?? 0,
    engagementRate:    m.engagement_rate ?? 0,
    mushinScore:       m.mushin_score ?? 0,
    mushinScoreDelta:  (m.mushin_score ?? 0) - (m.mushin_score_prev ?? m.mushin_score ?? 0),
    platform:          m.platform,
    growthRate30d:     m.growth_rate_30d ?? 0,
    indexedAt:         m.last_updated ?? new Date().toISOString(),
    metrics: {
      platform: m.platform,
      ...(m.platform_data ?? {}),
      fakeFollowerPct: m.fake_follower_pct ?? 0,
      verified:        m.verified ?? false,
    } as any,
    enrichment: {
      hasEmail:          Boolean(m.enrichment_email),
      emailSource:       m.enrichment_email_source ?? undefined,
      hasWhatsApp:       Boolean(m.enrichment_whatsapp),
      hasLinkedSocials:  Array.isArray(m.enrichment_linked_handles) && m.enrichment_linked_handles.length > 0,
      linkedSocialCount: Array.isArray(m.enrichment_linked_handles) ? m.enrichment_linked_handles.length : 0,
      hasWebsite:        Boolean(m.enrichment_has_website),
    },
    savedToList: false,
  };
}

// ── Source pill ───────────────────────────────────────────────
function SourcePill({ source, timingMs }: { source: DataSource; timingMs?: number }) {
  if (!source) return null;

  const config = {
    cache:       { color: "#10b981", label: "Cache",       icon: "⚡" },
    live:        { color: "#3b82f6", label: "Live",        icon: "🛰" },
    cache_stale: { color: "#f59e0b", label: "Stale cache", icon: "⏳" },
  }[source] ?? { color: "#6b7280", label: source, icon: "·" };

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium"
      style={{
        background: `${config.color}10`,
        border:     `1px solid ${config.color}25`,
        color:       config.color,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
      {timingMs !== undefined && (
        <span style={{ opacity: 0.6 }}>· {timingMs}ms</span>
      )}
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────
function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
          <circle cx="12" cy="12" r="9" stroke="#ef4444" strokeWidth="1.5"/>
          <path d="M12 8v5M12 16v.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-[14px] font-semibold text-white/50 mb-1">Discovery failed</p>
      <p className="text-[12px] text-white/25 max-w-[280px] mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded text-[12px] text-white/50 border border-white/10 hover:border-white/20 hover:text-white/70 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

// ── Live discovery status banner ──────────────────────────────
function LiveDiscoveryBanner() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const steps  = [0, 1, 2, 3];
    const delays = [0, 1800, 4500, 9000];
    const timers = delays.map((d, i) => setTimeout(() => setStep(steps[i]), d));
    return () => timers.forEach(clearTimeout);
  }, []);

  const stages = [
    { icon: "🔍", label: "Querying Serper OSINT engine…"      },
    { icon: "🛰",  label: "Running Google dork queries on PK creators…" },
    { icon: "⚙️",  label: "Enriching profiles via Apify scrapers…"     },
    { icon: "📊",  label: "Calculating MUSHIN Scores…"                 },
  ];

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 mx-5 mt-4 rounded-lg"
      style={{ background: "rgba(59,130,246,0.04)", border: "1px solid rgba(59,130,246,0.12)" }}
    >
      {/* Animated dots */}
      <div className="flex gap-1 flex-shrink-0">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-blue-400"
            style={{
              animation: "mushin-shimmer 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
      <div>
        <p className="text-[12px] font-medium text-blue-300/80">
          {stages[step]?.icon} {stages[step]?.label}
        </p>
        <p className="text-[10px] text-white/25 mt-0.5">
          Live discovery can take 15–90 seconds. Results will appear when ready.
        </p>
      </div>
    </div>
  );
}

// ── Freshness badge ───────────────────────────────────────────
function FreshnessBadge() {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px]"
      style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
      </span>
      <span className="text-emerald-400/80 font-medium">Live index</span>
    </div>
  );
}

// ── Active filter chips ────────────────────────────────────────
function ActiveChips({ filters, onChange }: { filters: SearchFilters; onChange: (f: SearchFilters) => void }) {
  const chips: { label: string; clear: () => void }[] = [];
  filters.platforms?.forEach((p) =>
    chips.push({ label: p, clear: () => onChange({ ...filters, platforms: filters.platforms!.filter((x) => x !== p) }) })
  );
  filters.niches?.forEach((n) =>
    chips.push({ label: n, clear: () => onChange({ ...filters, niches: filters.niches!.filter((x) => x !== n) }) })
  );
  filters.cities?.forEach((c) =>
    chips.push({ label: c, clear: () => onChange({ ...filters, cities: filters.cities!.filter((x) => x !== c) }) })
  );
  if (filters.hasEmail)    chips.push({ label: "Has Email",    clear: () => onChange({ ...filters, hasEmail:    false }) });
  if (filters.hasWhatsApp) chips.push({ label: "Has WhatsApp", clear: () => onChange({ ...filters, hasWhatsApp: false }) });
  if (filters.verifiedOnly) chips.push({ label: "Verified",   clear: () => onChange({ ...filters, verifiedOnly: false }) });
  if ((filters.minMushinScore ?? 0) > 0) chips.push({ label: `Score ≥ ${filters.minMushinScore}`, clear: () => onChange({ ...filters, minMushinScore: 0 }) });

  if (!chips.length) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {chips.map((chip) => (
        <button
          key={chip.label}
          onClick={chip.clear}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-white/60 border border-white/10 hover:border-white/20 hover:text-white/80 transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          {chip.label}
          <span className="text-white/30 ml-0.5">×</span>
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
export default function SearchDashboard() {
  const [filters,     setFilters]     = useState<SearchFilters>(DEFAULT_FILTERS);
  const [sortBy,      setSortBy]      = useState<SortKey>("mushin_score");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // State from edge function
  const [creators,    setCreators]    = useState<Creator[]>([]);
  const [loadState,   setLoadState]   = useState<LoadState>("idle");
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [source,      setSource]      = useState<DataSource>(null);
  const [timingMs,    setTimingMs]    = useState<number | undefined>();
  const [lastQuery,   setLastQuery]   = useState<SearchFilters | null>(null);

  // Debounce filters so we don't fire on every keystroke
  const debouncedFilters = useDebounce(filters, 700);

  // ── Fetch from edge function ────────────────────────────────
  const fetchCreators = useCallback(async (f: SearchFilters, isManualRetry = false) => {
    setLoadState("loading");
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.functions.invoke<EdgeFunctionResponse>(
        "discover-creators",
        { body: f }
      );

      if (error) throw new Error(error.message);
      if (!data)  throw new Error("Empty response from discover-creators");

      const normalised = (data.creators ?? []).map(normaliseCreator);
      setCreators(normalised);
      setSource(data.source);
      setTimingMs(data.timing?.total_ms);
      setLoadState("success");
      setLastQuery(f);

      if (data.warning) {
        console.warn("[discover]", data.warning);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[discover] error:", msg);
      setErrorMsg(msg);
      setLoadState("error");
    }
  }, []);

  // Trigger fetch when debounced filters change
  useEffect(() => {
    fetchCreators(debouncedFilters);
  }, [debouncedFilters, fetchCreators]);

  // ── Client-side sort ─────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...creators].sort((a, b) => {
      if (sortBy === "mushin_score")    return b.mushinScore    - a.mushinScore;
      if (sortBy === "followers")       return b.followers      - a.followers;
      if (sortBy === "engagement_rate") return b.engagementRate - a.engagementRate;
      if (sortBy === "growth_rate_30d") return b.growthRate30d  - a.growthRate30d;
      return 0;
    });
  }, [creators, sortBy]);

  const isLoading     = loadState === "loading";
  const isError       = loadState === "error";
  const hasFilters    = Boolean(
    filters.platforms?.length || filters.niches?.length || filters.cities?.length ||
    filters.hasEmail || filters.hasWhatsApp || filters.verifiedOnly ||
    (filters.minMushinScore ?? 0) > 0
  );

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "#060608", fontFamily: "'Outfit', system-ui, sans-serif" }}
    >

      {/* ── SIDEBAR ── */}
      <div
        className="flex-shrink-0 border-r border-white/[0.05] transition-all duration-300 overflow-hidden"
        style={{ width: sidebarOpen ? 220 : 0 }}
      >
        {sidebarOpen && (
          <SearchSidebar
            filters={filters}
            onChange={setFilters}
            resultCount={isLoading ? 0 : sorted.length}
          />
        )}
      </div>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── TOP BAR ── */}
        <div
          className="flex-shrink-0 border-b border-white/[0.05] px-5 py-3 flex items-center gap-4"
          style={{ background: "#060608" }}
        >
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-white/5 transition-colors text-white/30 hover:text-white/60 flex-shrink-0"
            aria-label="Toggle filters"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <svg
              viewBox="0 0 16 16" fill="none"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none"
            >
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              placeholder="Search creators, niches, cities…"
              value={filters.query ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              className="w-full pl-8 pr-4 py-2 rounded text-[13px] outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border:     "1px solid rgba(255,255,255,0.08)",
                color:      "rgba(255,255,255,0.75)",
              }}
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[10px] text-white/25 uppercase tracking-wider">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="text-[11px] py-1.5 px-2 rounded outline-none appearance-none cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.04)",
                border:     "1px solid rgba(255,255,255,0.08)",
                color:      "rgba(255,255,255,0.55)",
              }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Data source + timing */}
          {source && !isLoading && (
            <SourcePill source={source} timingMs={timingMs} />
          )}

          {/* Freshness badge */}
          <FreshnessBadge />
        </div>

        {/* ── ACTIVE FILTER CHIPS ── */}
        {hasFilters && (
          <div
            className="flex-shrink-0 px-5 py-2.5 border-b border-white/[0.04] flex items-center gap-4"
            style={{ background: "rgba(255,255,255,0.01)" }}
          >
            <ActiveChips filters={filters} onChange={setFilters} />
          </div>
        )}

        {/* ── LIVE DISCOVERY BANNER (only during live scrape) ── */}
        {isLoading && source === null && (
          <LiveDiscoveryBanner />
        )}

        {/* ── RESULTS AREA ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* Error state */}
          {isError && (
            <ErrorBanner
              message={errorMsg ?? "Unknown error"}
              onRetry={() => fetchCreators(filters, true)}
            />
          )}

          {/* Loading state — skeletons */}
          {isLoading && (
            <>
              {/* Result count placeholder */}
              <div className="flex items-center justify-between mb-4">
                <div
                  className="ms-shimmer rounded"
                  style={{ width: 120, height: 14 }}
                  aria-hidden
                />
              </div>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
              >
                <CreatorCardSkeletonGrid count={6} />
              </div>
            </>
          )}

          {/* Success state */}
          {!isLoading && !isError && (
            sorted.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                    <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
                    <path d="M16.5 16.5L21 21" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-white/50 mb-1">
                  No creators match these filters
                </p>
                <p className="text-[12px] text-white/25">
                  Try widening your filters or resetting them
                </p>
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="mt-4 px-4 py-2 rounded text-[12px] text-white/50 border border-white/10 hover:border-white/20 hover:text-white/70 transition-colors"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <>
                {/* Result count */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[12px] text-white/35">
                    <span
                      className="text-white/70 font-semibold"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {sorted.length}
                    </span>{" "}
                    creators
                    {source === "live" && (
                      <span className="text-blue-400/60 ml-2 text-[11px]">
                        · Freshly discovered
                      </span>
                    )}
                    {source === "cache_stale" && (
                      <span className="text-amber-400/60 ml-2 text-[11px]">
                        · Stale data — refreshing in background
                      </span>
                    )}
                  </p>

                  {/* Score legend */}
                  <div className="flex items-center gap-3 text-[9px] text-white/20 uppercase tracking-wider">
                    {[
                      { color: "#10b981", label: "Elite 86+" },
                      { color: "#3b82f6", label: "Strong 66+" },
                      { color: "#f59e0b", label: "Avg 41+"    },
                      { color: "#ef4444", label: "Weak"       },
                    ].map(({ color, label }) => (
                      <span key={label} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Creator grid */}
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
                >
                  {sorted.map((creator, i) => (
                    <CreatorCard
                      key={creator.id}
                      creator={creator}
                      animationDelay={i * 40}
                      onSave={(id)     => console.log("Save:", id)}
                      onOutreach={(id) => console.log("Outreach:", id)}
                    />
                  ))}
                </div>
              </>
            )
          )}
        </div>
      </div>

      {/* Shimmer keyframes (re-injected here as fallback) */}
      <style>{`
        @keyframes mushin-shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position:  600px 0; }
        }
        .ms-shimmer {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.03) 0%,
            rgba(255,255,255,0.07) 40%,
            rgba(255,255,255,0.03) 80%
          );
          background-size: 600px 100%;
          animation: mushin-shimmer 1.6s ease-in-out infinite;
          border-radius: 4px;
        }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        article { animation: card-in 0.35s ease both; }
      `}</style>
    </div>
  );
}
