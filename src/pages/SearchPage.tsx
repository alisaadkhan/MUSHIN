import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Search as SearchIcon, Filter, ExternalLink, Loader2, Bookmark,
  AlertCircle, Lock, Sparkles, Plus, MoreHorizontal, MapPin, Instagram, Youtube, ShieldCheck,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeAuthed } from "@/lib/edge";
import { useInfluencerLists } from "@/hooks/useInfluencerLists";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { EvaluationScoreBadge } from "@/components/influencer/EvaluationScoreBadge";
import { useInfluencerEvaluation } from "@/hooks/useInfluencerEvaluation";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { getQualityTier } from "@/modules/search/ranking";
import { ResultCard, type SearchResult as SearchResultCard } from "@/components/search/ResultCard";

function LiveDiscoveryBanner() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const steps = [0, 1, 2, 3];
    const delays = [0, 1600, 4200, 8500];
    const timers = delays.map((d, i) => setTimeout(() => setStep(steps[i]), d));
    return () => timers.forEach(clearTimeout);
  }, []);

  const stages = [
    { label: "Initializing search…" },
    { label: "Dorking platforms for Pakistani creators…" },
    { label: "Enriching profiles & extracting contacts…" },
    { label: "Calculating MUSHIN Scores…" },
  ];

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/15 bg-primary/5">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-primary"
            style={{
              animation: "mushinPulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-primary/90 font-medium truncate">{stages[step]?.label}</p>
        <p className="text-xs text-muted-foreground">Live discovery can take 15–90 seconds.</p>
      </div>
      <style>{`
        @keyframes mushinPulse {
          0%, 100% { transform: translateY(0); opacity: 0.55; }
          50%      { transform: translateY(-2px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORMS = ["Instagram", "TikTok", "YouTube", "Twitch"];

const PK_CITIES = [
  "All Pakistan",
  "Karachi", "Lahore", "Islamabad", "Rawalpindi",
  "Faisalabad", "Multan", "Peshawar", "Quetta",
  "Sialkot", "Gujranwala",
];

const FOLLOWER_RANGES = [
  { label: "Any size", value: "any" },
  { label: "Nano (1k–10k)", value: "1k-10k" },
  { label: "Micro (10k–50k)", value: "10k-50k" },
  { label: "Mid-tier (50k–100k)", value: "50k-100k" },
  { label: "Macro (100k–500k)", value: "100k-500k" },
  { label: "Mega (500k+)", value: "500k+" },
];

// Maximum number of niches a user can select simultaneously
const MAX_NICHES = 3;

// ─── FilterPanel — shared between desktop sidebar and mobile Sheet ────────────
interface FilterPanelProps {
  selectedPlatforms: string[];
  togglePlatform: (p: string) => void;
  selectedCity: string;
  setSelectedCity: (v: string) => void;
  followerRange: string;
  setFollowerRange: (v: string) => void;
}

function FilterPanel({
  selectedPlatforms, togglePlatform,
  selectedCity, setSelectedCity,
  followerRange, setFollowerRange,
}: FilterPanelProps) {
  return (
    <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Filter size={15} strokeWidth={1.5} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Filters</h3>
      </div>

      {/* Platform — chips */}
      <div>
        <p className="text-xs font-medium text-foreground mb-2">Platform</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const active = selectedPlatforms.includes(p);
            return (
              <button
                key={p}
                data-testid={`platform-${p.toLowerCase()}`}
                onClick={() => togglePlatform(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <PlatformIcon platform={p} /> {p}
              </button>
            );
          })}
        </div>
        {selectedPlatforms.length === 0 && (
          <p className="text-[10px] text-amber-500/80 mt-1.5">⚠️ Select a platform to search</p>
        )}
      </div>

      {/* Location */}
      <div>
        <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-primary" /> Location
        </p>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {PK_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Follower range */}
      <div>
        <p className="text-xs font-medium text-foreground mb-2">Follower Range</p>
        <select
          value={followerRange}
          onChange={(e) => setFollowerRange(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {FOLLOWER_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      </div>
    </div>
  );
}

// ─── Cache key for back-navigation result restoration ───────────────────────
function buildCacheKey(q: string, platform: string | string[], city: string, range: string) {
  const pStr = Array.isArray(platform)
    ? [...platform].map(p => p.toLowerCase()).sort().join(",") || "instagram"
    : platform.toLowerCase();
  return `mushin_sr:${q.toLowerCase()}|${pStr}|${city}|${range}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  username: string;
  platform: string;
  displayUrl?: string;
  extracted_followers?: number;
  imageUrl?: string;
  niche?: string;
  city?: string;
  city_extracted?: string;
  engagement_rate?: number;
  engagement_is_estimated?: boolean;
  bio?: string;
  full_name?: string;
  contact_email?: string | null;
  social_links?: string[];
  /** Server-computed multi-factor relevance score [0, 1]. Used for card display & sort order. */
  _search_score?: number;
  niche_confidence?: number;
  is_enriched?: boolean;
  enrichment_status?: string;
  is_stale?: boolean;
  last_enriched_at?: string | null;
  enrichment_ttl_days?: number;
  engagement_source?: "real_eval" | "real_enriched" | "benchmark_estimate";
  engagement_benchmark_bucket?: string;
  /** Detected search intent for the query that produced this result. */
  _intent?: string;
  /** Creator topic tags from AI tag pipeline (creator_tags table, denormalized into cache). */
  tags?: string[];
  mushin_score?: number;
  fake_follower_pct?: number;
  enrichment_whatsapp?: string | null;
  enrichment_linked_handles?: string[];
}

function dedupeSearchResults(input: SearchResult[]): SearchResult[] {
  const merged = new Map<string, SearchResult>();
  for (const item of input) {
    const platform = (item.platform ?? "").toLowerCase();
    const username = (item.username ?? "").trim().toLowerCase().replace(/^@/, "");
    const link = (item.link ?? "").trim().toLowerCase();
    const key = username ? `${platform}:${username}` : `${platform}:link:${link}`;

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }

    const existingScore = Number(existing._search_score ?? 0);
    const incomingScore = Number(item._search_score ?? 0);
    if (incomingScore >= existingScore) {
      merged.set(key, { ...existing, ...item, _search_score: Math.max(existingScore, incomingScore) });
    } else {
      merged.set(key, { ...item, ...existing, _search_score: Math.max(existingScore, incomingScore) });
    }
  }

  return [...merged.values()];
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === "instagram") return <Instagram className="h-3.5 w-3.5 text-pink-500" />;
  if (p === "youtube") return <Youtube className="h-3.5 w-3.5 text-red-500" />;
  if (p === "twitch") return <span className="text-xs font-bold" style={{ color: "#9147ff" }}>TV</span>;
  // TikTok — use Unicode glyph
  return <span className="text-xs font-bold text-foreground">TT</span>;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State — hydrated from URL params to preserve across back-nav
  const sanitizeInput = (input: string | null, maxLength: number = 200): string => {
    if (!input) return "";
    return input.replace(/[<>]/g, "").slice(0, maxLength);
  };
  const parsePlatformsParam = (raw: string | null): string[] => {
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };
  const [query, setQuery] = useState(() => sanitizeInput(searchParams.get("q")));
  const [isAiSearch, setIsAiSearch] = useState(searchParams.get("ai") === "1");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    parsePlatformsParam(searchParams.get("platform"))
  );
  const [selectedCity, setSelectedCity] = useState(searchParams.get("city") || "All Pakistan");
  const [followerRange, setFollowerRange] = useState(searchParams.get("range") || "any");

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  const { data: workspaceCredits } = useWorkspaceCredits();
  const { evaluate: evaluateInfluencer, loading: evalLoading } = useInfluencerEvaluation();
  const { canUseAI } = usePlanLimits();
  const [evaluatingUsername, setEvaluatingUsername] = useState<string | null>(null);
  const [cachedScores, setCachedScores] = useState<Record<string, number>>({});

  const creditsExhausted = workspaceCredits?.search_credits_remaining === 0;
  const isFreePlan = workspaceCredits?.plan === "free";
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showCreditsPopup, setShowCreditsPopup] = useState(false);
  const showInsufficientCredits = useCallback(() => {
    setShowCreditsPopup(true);
  }, []);

  const isInsufficientCreditsError = useCallback((err: any): boolean => {
    const status = err?.context?.status ?? err?.status ?? err?.statusCode;
    if (status === 402) return true;
    const msg = String(err?.message ?? err ?? "");
    return msg.includes("402") || msg.toLowerCase().includes("insufficient_credits");
  }, []);

  const { data: lists, createList } = useInfluencerLists();
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [pendingAddResult, setPendingAddResult] = useState<SearchResult | null>(null);
  const { saveSearch } = useSavedSearches();
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");

  const hasAutoSearched = useRef(false);

  // Persist state to URL so back-nav doesn't re-run
  const syncParams = useCallback((overrides: Record<string, string> = {}) => {
    const next: Record<string, string> = {};
    if (query) next.q = query;
    if (isAiSearch) next.ai = "1";
    if (selectedPlatforms.length) next.platform = selectedPlatforms.join(",");
    if (selectedCity !== "All Pakistan") next.city = selectedCity;
    if (followerRange !== "any") next.range = followerRange;
    setSearchParams({ ...next, ...overrides }, { replace: true });
  }, [query, isAiSearch, selectedPlatforms, selectedCity, followerRange, setSearchParams]);

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  // Auto-run once on load — restore from session cache first (no credit burn on back-nav)
  useEffect(() => {
    // If user navigated away and came back with no params, restore last search URL.
    if (!searchParams.get("q")) {
      try {
        const last = sessionStorage.getItem("mushin_last_search_url");
        if (last && last.startsWith("?")) {
          setSearchParams(last.slice(1), { replace: true });
        }
      } catch {
        /* ignore */
      }
    }
    if (searchParams.get("q") && !hasAutoSearched.current && !searched) {
      hasAutoSearched.current = true;
      const cacheKey = buildCacheKey(
        searchParams.get("q") || "",
        parsePlatformsParam(searchParams.get("platform")).length
          ? parsePlatformsParam(searchParams.get("platform"))
          : (searchParams.get("platform") || "instagram"),
        searchParams.get("city") || "All Pakistan",
        searchParams.get("range") || "any",
      );
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { results: cr, creditsRemaining: ccr } = JSON.parse(cached);
          setResults(cr);
          setSearched(true);
          return; // skip re-fetching
        }
      } catch { /* corrupt cache — fall through to live search */ }
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    if (selectedPlatforms.length === 0) {
      toast({
        title: "Platform required",
        description: "Please select at least one platform to search creators.",
        variant: "destructive",
      });
      return;
    }
    if (creditsExhausted) { setShowCreditsPopup(true); return; }

    setLoading(true);
    setSearched(true);
    setSearchError(null);
    setVisibleCount(28);
    syncParams();

    const rawPlatforms = selectedPlatforms.length > 0
      ? selectedPlatforms.map(p => p.toLowerCase())
      : ["instagram"];
    const supported = ["instagram", "tiktok", "youtube"];
    const platforms = rawPlatforms.filter((p) => supported.includes(p));
    if (rawPlatforms.includes("twitch")) {
      toast({
        title: "Twitch not supported",
        description: "Discovery currently supports Instagram, TikTok, and YouTube only.",
      });
    }
    if (platforms.length === 0) {
      toast({
        title: "Platform required",
        description: "Please select Instagram, TikTok, or YouTube to run discovery.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      let sortedResults: SearchResult[] = [];

      // Phase 2: single Intelligence Engine — discover-creators (live Serper+Apify)
      const minFollowersFromRange: Record<string, number> = {
        any: 1_000,
        "1k-10k": 1_000,
        "10k-50k": 10_000,
        "50k-100k": 50_000,
        "100k-500k": 100_000,
        "500k+": 500_000,
      };
      const minFollowers = minFollowersFromRange[followerRange] ?? 10_000;
      const exKey = `${buildCacheKey(query.trim(), platforms, selectedCity, followerRange)}:ex`;
      let exclude_handles: string[] = [];
      try {
        const raw = sessionStorage.getItem(exKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) exclude_handles = parsed.map((s) => String(s)).slice(0, 120);
        }
      } catch {
        exclude_handles = [];
      }

      const body = {
        query: query.trim(),
        platforms,
        cities: selectedCity !== "All Pakistan" ? [selectedCity] : [],
        minFollowers,
        exclude_handles,
      };

      const { data, error } = await invokeEdgeAuthed<Record<string, unknown>>("discover-creators", { body });
      if (error) {
        if (isInsufficientCreditsError(error)) {
          showInsufficientCredits();
          return;
        }
        throw error;
      }
      if (data?.error) {
        if (data?.code === "insufficient_credits") {
          showInsufficientCredits();
          return;
        }
        toast({ title: "Search failed", description: data.error, variant: "destructive" });
        setResults([]);
        return;
      }

      const rows = (data?.creators ?? []) as any[];
      const mapped: SearchResult[] = rows.map((m: any) => ({
        title: m.display_name ?? m.handle ?? "",
        link: m.profile_url ?? "",
        snippet: m.bio ?? "",
        username: m.handle ?? "",
        platform: m.platform ?? "",
        imageUrl: m.avatar_url ?? null,
        niche: Array.isArray(m.niches) && m.niches.length ? m.niches[0] : null,
        city: m.city ?? null,
        extracted_followers: m.followers ?? null,
        engagement_rate: m.engagement_rate ?? null,
        bio: m.bio ?? null,
        full_name: m.display_name ?? null,
        contact_email: m.enrichment_email ?? null,
        social_links: Array.isArray(m.enrichment_linked_handles) ? m.enrichment_linked_handles : [],
        mushin_score: m.mushin_score ?? null,
        fake_follower_pct: m.fake_follower_pct ?? null,
        enrichment_whatsapp: m.enrichment_whatsapp ?? null,
        enrichment_linked_handles: Array.isArray(m.enrichment_linked_handles) ? m.enrichment_linked_handles : [],
        is_enriched: true,
      }));

      sortedResults = dedupeSearchResults(mapped);

      setResults(sortedResults);

      try {
        const handleKeys = sortedResults.map((r) => {
          const pl = (r.platform || "instagram").toLowerCase();
          const h = String(r.username || "").replace(/^@/, "").toLowerCase();
          return `${pl}:${h}`;
        });
        sessionStorage.setItem(exKey, JSON.stringify(handleKeys.slice(0, 80)));
      } catch {
        /* ignore */
      }

      const cacheKey = buildCacheKey(query.trim(), platforms, selectedCity, followerRange);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          results: sortedResults,
          creditsRemaining: null,
        }));
        const urlParams = new URLSearchParams();
        urlParams.set("q", query.trim());
        if (selectedPlatforms.length) urlParams.set("platform", selectedPlatforms.join(","));
        if (selectedCity !== "All Pakistan") urlParams.set("city", selectedCity);
        if (followerRange !== "any") urlParams.set("range", followerRange);
        sessionStorage.setItem("mushin_last_search_url", `?${urlParams.toString()}`);
      } catch { /* sessionStorage full — skip caching */ }

      queryClient.invalidateQueries({ queryKey: ["workspace-credits"] });
      queryClient.invalidateQueries({ queryKey: ["search-history"] });

      if (sortedResults.length === 0) {
        toast({ title: "No results", description: "Try a different keyword, city, or platform." });
      }
    } catch (err: any) {
      if (isInsufficientCreditsError(err)) {
        showInsufficientCredits();
        setResults([]);
        return;
      }
      setSearchError(err.message || "Something went wrong");
      toast({ title: "Search failed", description: err.message || "Something went wrong", variant: "destructive" });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedPlatforms, creditsExhausted, isAiSearch, selectedCity, followerRange, toast, syncParams, queryClient, isInsufficientCreditsError, showInsufficientCredits]);

  const handleAddToList = async (listId: string, result: SearchResult) => {
    try {
      const { error } = await supabase.from("list_items").insert({
        list_id: listId,
        username: result.username,
        platform: result.platform,
        data: { title: result.title, link: result.link, snippet: result.snippet, displayUrl: result.displayUrl },
      });
      if (error?.code === "23505") {
        toast({ title: "Already in list" });
      } else if (error) {
        throw error;
      } else {
        queryClient.invalidateQueries({ queryKey: ["influencer-lists"] });
        toast({ title: "Added to list" });
      }
    } catch {
      toast({ title: "Failed to add", variant: "destructive" });
    }
  };

  const handleCreateListAndAdd = async () => {
    if (!newListName.trim() || !pendingAddResult) return;
    try {
      const newList = await createList.mutateAsync(newListName.trim());
      await handleAddToList(newList.id, pendingAddResult);
      setShowCreateList(false);
      setNewListName("");
      setPendingAddResult(null);
    } catch {
      toast({ title: "Failed to create list", variant: "destructive" });
    }
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) return;
    try {
      await saveSearch.mutateAsync({
        name: saveSearchName.trim(),
        filters: { query, platform: selectedPlatforms[0] || "instagram", location: selectedCity },
      });
      toast({ title: "Search saved" });
      setShowSaveSearch(false);
      setSaveSearchName("");
    } catch {
      toast({ title: "Failed to save search", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Discover Pakistani Creators</h1>
          <p className="text-sm text-muted-foreground">Search across Instagram, TikTok & YouTube in Pakistan</p>
        </div>
        {workspaceCredits?.search_credits_remaining != null && (
          <Badge data-testid="credits-badge" variant="outline" className={`text-xs gap-1.5 py-1 px-3 ${creditsExhausted ? "border-destructive text-destructive" : ""}`}>
            {workspaceCredits.search_credits_remaining} credits left
          </Badge>
        )}
      </div>

      {creditsExhausted && workspaceCredits?.credits_reset_at && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You've used all your search credits. Credits reset on{" "}
            <span className="font-semibold">{format(new Date(workspaceCredits.credits_reset_at), "MMMM d, yyyy")}</span>.
          </AlertDescription>
        </Alert>
      )}

      {isFreePlan && searched && results.length > 0 && !bannerDismissed && (
        <Alert className="border-primary/30 bg-primary/5">
          <Lock className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span>You're on the Free plan. Upgrade to see full influencer profiles.</span>
            <div className="flex items-center gap-2 ml-4">
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => navigate("/billing")}>Upgrade</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setBannerDismissed(true)}>Dismiss</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-6">
        {/* ── Sidebar Filters (desktop: lg+) ──────────────────── */}
        <aside className="w-64 flex-shrink-0 hidden lg:block space-y-4">
          <FilterPanel
            selectedPlatforms={selectedPlatforms}
            togglePlatform={togglePlatform}
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
            followerRange={followerRange}
            setFollowerRange={setFollowerRange}
          />
        </aside>

        {/* ── Mobile Filter Sheet ───────────────────────────────── */}
        <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
          <SheetContent side="bottom" className="h-[88dvh] rounded-t-2xl overflow-y-auto px-4 py-5 lg:hidden">
            <SheetHeader className="mb-4">
              <SheetTitle className="text-base flex items-center gap-2">
                <Filter size={15} className="text-primary" /> Filters
              </SheetTitle>
            </SheetHeader>
            <FilterPanel
              selectedPlatforms={selectedPlatforms}
              togglePlatform={togglePlatform}
              selectedCity={selectedCity}
              setSelectedCity={setSelectedCity}
              followerRange={followerRange}
              setFollowerRange={setFollowerRange}
            />
            <SheetFooter className="mt-6 gap-2 flex-col">
              <Button className="w-full btn-shine" onClick={() => { setShowMobileFilters(false); handleSearch(); }}>
                <SearchIcon className="h-4 w-4 mr-2" /> Apply &amp; Search
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowMobileFilters(false)}>
                Close
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* ── Main Content ─────────────────────────────────────── */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* Search bar row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              {isAiSearch
                ? <Sparkles size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                : <SearchIcon size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              }
              <input
                data-testid="search-input"
                type="text"
                placeholder={isAiSearch
                  ? "Describe the ideal Pakistani creator..."
                  : "Search by name, handle, or niche..."}
                className={`w-full h-10 pl-9 pr-4 rounded-lg border bg-background/80 backdrop-blur-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${isAiSearch ? "border-primary/50 placeholder:text-primary/50" : "border-border placeholder:text-muted-foreground"}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            {/* Mobile filters button */}
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 lg:hidden relative"
              onClick={() => setShowMobileFilters(true)}
              aria-label="Open filters"
            >
              <Filter size={16} strokeWidth={1.5} />
              {(selectedPlatforms.length > 0 || selectedCity !== "All Pakistan" || followerRange !== "any") && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-[10px] text-white flex items-center justify-center font-bold leading-none">
                  {selectedPlatforms.length + (selectedCity !== "All Pakistan" ? 1 : 0) + (followerRange !== "any" ? 1 : 0)}
                </span>
              )}
            </Button>
            {/* AI Mode toggle (desktop) */}
            <div
              title="AI Mode — Coming Soon"
              className="hidden sm:flex relative items-center space-x-2 bg-card/50 border border-white/20 px-3 h-10 rounded-lg shrink-0 opacity-50 cursor-not-allowed select-none"
            >
              <Switch
                id="ai-mode"
                checked={false}
                onCheckedChange={() => {}}
                disabled
                className="pointer-events-none"
              />
              <Label htmlFor="ai-mode" className="text-xs font-medium flex items-center gap-1 pointer-events-none">
                <Sparkles className="h-3 w-3" /> AI
              </Label>
              <span className="absolute -top-2 -right-2 text-[9px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5 leading-none tracking-wide pointer-events-none">
                SOON
              </span>
            </div>
            <Button
              data-testid="search-btn"
              className="btn-shine gap-2 rounded-lg shrink-0"
              disabled={!query.trim() || loading || creditsExhausted}
              onClick={handleSearch}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
              <span className="hidden sm:inline">Search</span>
            </Button>
          </div>

          {/* Mobile platform chips strip */}
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden no-scrollbar -mx-1 px-1">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                data-testid={`platform-chip-${p.toLowerCase()}`}
                onClick={() => togglePlatform(p)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap flex-shrink-0 transition-colors touch-manipulation ${
                  selectedPlatforms.includes(p)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                <PlatformIcon platform={p} />
                {p}
              </button>
            ))}
          </div>

          {/* Active filter badges row (mobile) */}
          {selectedCity !== "All Pakistan" && (
            <div className="flex flex-wrap gap-2 lg:hidden">
              {selectedCity !== "All Pakistan" && (
                <button onClick={() => setSelectedCity("All Pakistan")}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-muted text-muted-foreground border border-border">
                  <MapPin size={10} /> {selectedCity} <XIcon size={10} />
                </button>
              )}
            </div>
          )}

          {/* Results meta row */}
          <div className="flex items-center justify-between min-h-[28px]">
            {searched && results.length > 0 && (
              <p data-testid="result-count" className="text-sm text-muted-foreground">
                {results.length} result{results.length !== 1 ? "s" : ""} found
                {selectedCity !== "All Pakistan" && <span> · <MapPin className="inline h-3 w-3 mb-0.5" /> {selectedCity}</span>}
              </p>
            )}
            {searched && results.length > 0 && (
              <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-lg border-border" onClick={() => setShowSaveSearch(true)}>
                <Bookmark className="h-3 w-3" /> Save Search
              </Button>
            )}
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div data-testid="loading-state" className="space-y-4">
              <LiveDiscoveryBanner />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div>
                    </div>
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && searched && results.length > 0 && (() => {
            const visible = results.slice(0, visibleCount);
            const hasMore = results.length > visibleCount;
            return (
              <>
                <div data-testid="results-grid" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {visible.map((c, i) => (
                    <ResultCard
                      key={`${c.platform}-${c.username}-${c.link || i}`}
                      c={c as unknown as SearchResultCard}
                      isFreePlan={isFreePlan}
                      lists={lists}
                      cachedScores={cachedScores}
                      evaluatingUsername={evaluatingUsername}
                      evalLoading={evalLoading}
                      canUseAI={canUseAI}
                      navigate={navigate}
                      evaluateInfluencer={evaluateInfluencer}
                      setEvaluatingUsername={setEvaluatingUsername}
                      setCachedScores={setCachedScores}
                      handleAddToList={handleAddToList}
                      setPendingAddResult={setPendingAddResult}
                      setShowCreateList={setShowCreateList}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      className="gap-2 rounded-xl px-6"
                      onClick={() => setVisibleCount(v => v + 12)}
                    >
                      <Plus className="h-4 w-4" />
                      Load more ({results.length - visibleCount} remaining)
                    </Button>
                  </div>
                )}
                {!hasMore && results.length > 12 && (
                  <p className="text-center text-xs text-muted-foreground pt-2">All {results.length} results shown</p>
                )}
              </>
            );
          })()}

          {/* Initial / empty state */}
          {!loading && !searched && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex flex-col items-center justify-center py-16 text-center bg-card/50 backdrop-blur-sm border border-white/50 shadow-sm rounded-2xl">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
                  <SearchIcon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-1">Find Pakistani Creators</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Search by name, niche, or city — filter by Karachi, Lahore, Islamabad and 9 more cities. Each search uses 1 credit.
                </p>
              </div>
            </motion.div>
          )}

          {/* Error state */}
          {!loading && searchError && (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-destructive/5 border border-destructive/20 rounded-2xl">
              <AlertCircle className="h-10 w-10 text-destructive mb-3" />
              <h3 className="font-serif text-lg font-semibold text-foreground mb-1">Search Error</h3>
              <p className="text-sm text-muted-foreground max-w-md">{searchError}</p>
            </div>
          )}

          {/* No results */}
          {!loading && searched && results.length === 0 && !searchError && (
            <div data-testid="no-results" className="flex flex-col items-center justify-center py-20 text-center bg-card/50 backdrop-blur-sm border border-white/50 shadow-sm rounded-2xl">
              <SearchIcon className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-serif text-lg font-semibold text-foreground mb-1">No Results Found</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Try different keywords, another city, or a broader platform selection.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create List Dialog */}
      <Dialog open={showCreateList} onOpenChange={setShowCreateList}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create New List</DialogTitle></DialogHeader>
          <Input placeholder="e.g. Ramadan Campaign 2026" value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateListAndAdd()}
            className="my-4" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateList(false)}>Cancel</Button>
            <Button onClick={handleCreateListAndAdd} disabled={!newListName.trim()}>Create & Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Search Dialog */}
      <Dialog open={showSaveSearch} onOpenChange={setShowSaveSearch}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Save This Search</DialogTitle></DialogHeader>
          <Input placeholder="e.g. Lahore Fashion Influencers" value={saveSearchName}
            onChange={(e) => setSaveSearchName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
            className="my-4" />
          <div className="flex gap-2 flex-wrap mb-4">
            <Badge variant="secondary" className="px-2">{query}</Badge>
            {selectedPlatforms.map(p => <Badge key={p} variant="outline" className="px-2">{p}</Badge>)}
            {selectedCity !== "All Pakistan" && <Badge variant="outline" className="px-2">{selectedCity}</Badge>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveSearch(false)}>Cancel</Button>
            <Button onClick={handleSaveSearch} disabled={!saveSearchName.trim() || saveSearch.isPending}>
              {saveSearch.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credits Exhausted */}
      <Dialog open={showCreditsPopup} onOpenChange={setShowCreditsPopup}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              Daily Credits Used Up
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You've used all {isFreePlan ? "3" : "your"} daily search credits.
            {isFreePlan ? " Upgrade to Pro for 500 credits/month — pay in PKR via JazzCash." : " Credits reset daily."}
          </p>
          {workspaceCredits?.credits_reset_at && (
            <p className="text-xs text-muted-foreground">
              Credits reset on {format(new Date(workspaceCredits.credits_reset_at), "MMMM d, yyyy")}
            </p>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            {isFreePlan && (
              <Button className="w-full btn-shine" onClick={() => { setShowCreditsPopup(false); navigate("/billing"); }}>
                Upgrade to Pro · ₨4,999/mo
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => setShowCreditsPopup(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
