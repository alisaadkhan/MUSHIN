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
  const [query, setQuery] = useState(() => sanitizeInput(searchParams.get("q")));
  const [isAiSearch, setIsAiSearch] = useState(searchParams.get("ai") === "1");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    searchParams.get("platform") ? [searchParams.get("platform")!] : []
  );
  const [selectedCity, setSelectedCity] = useState(searchParams.get("city") || "All Pakistan");
  const [followerRange, setFollowerRange] = useState(searchParams.get("range") || "any");

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
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
    if (selectedPlatforms[0]) next.platform = selectedPlatforms[0];
    if (selectedCity !== "All Pakistan") next.city = selectedCity;
    if (followerRange !== "any") next.range = followerRange;
    setSearchParams({ ...next, ...overrides }, { replace: true });
  }, [query, isAiSearch, selectedPlatforms, selectedCity, followerRange, setSearchParams]);

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  // Auto-run once on load — restore from session cache first (no credit burn on back-nav)
  useEffect(() => {
    if (searchParams.get("q") && !hasAutoSearched.current && !searched) {
      hasAutoSearched.current = true;
      const cacheKey = buildCacheKey(
        searchParams.get("q") || "",
        searchParams.get("platform") || "instagram",
        searchParams.get("city") || "All Pakistan",
        searchParams.get("range") || "any",
      );
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { results: cr, creditsRemaining: ccr } = JSON.parse(cached);
          setResults(cr);
          setSearched(true);
          if (ccr != null) setCreditsRemaining(ccr);
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
    setVisibleCount(12);
    syncParams();

    const platforms = selectedPlatforms.length > 0
      ? selectedPlatforms.map(p => p.toLowerCase())
      : ["instagram"];

    try {
      let sortedResults: SearchResult[] = [];
      let creditsLeft: number | null = null;

      if (platforms.length === 1) {
        const endpoint = isAiSearch ? "search-natural" : "search-influencers";
        const body = isAiSearch
          ? { query: query.trim(), platform: platforms[0], location: selectedCity }
          : { query: query.trim(), platform: platforms[0], location: selectedCity, followerRange };

        const { data, error } = await supabase.functions.invoke(endpoint, { body });
        if (error) throw error;

        if (data?.error) {
          toast({ title: "Search failed", description: data.error, variant: "destructive" });
          setResults([]);
          return;
        }

        sortedResults = dedupeSearchResults(data.results || []);
        creditsLeft = data.credits_remaining ?? null;
      } else {
        const responses = await Promise.allSettled(
          platforms.map(p =>
            supabase.functions.invoke("search-influencers", {
              body: { query: query.trim(), platform: p, location: selectedCity, followerRange },
            })
          )
        );
        const merged: SearchResult[] = [];
        for (const r of responses) {
          if (r.status === "fulfilled" && !r.value.error && r.value.data?.results) {
            merged.push(...r.value.data.results);
            if (r.value.data.credits_remaining != null) creditsLeft = r.value.data.credits_remaining;
          }
        }
        sortedResults = dedupeSearchResults(merged).sort((a, b) => (b._search_score ?? 0) - (a._search_score ?? 0));
      }

      setResults(sortedResults);
      setCreditsRemaining(creditsLeft);

      const cacheKey = buildCacheKey(query.trim(), platforms, selectedCity, followerRange);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({
          results: sortedResults,
          creditsRemaining: creditsLeft,
        }));
        const urlParams = new URLSearchParams();
        urlParams.set("q", query.trim());
        if (selectedPlatforms[0]) urlParams.set("platform", selectedPlatforms[0]);
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
      setSearchError(err.message || "Something went wrong");
      toast({ title: "Search failed", description: err.message || "Something went wrong", variant: "destructive" });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedPlatforms, creditsExhausted, isAiSearch, selectedCity, followerRange, toast, syncParams, queryClient]);

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
        {creditsRemaining !== null && (
          <Badge data-testid="credits-badge" variant="outline" className={`text-xs gap-1.5 py-1 px-3 ${creditsExhausted ? "border-destructive text-destructive" : ""}`}>
            {creditsRemaining} credits left
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
            <div data-testid="loading-state" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
                      c={c}
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

// ─── Result Card sub-component ────────────────────────────────────────────────
interface ResultCardProps {
  c: SearchResult;
  isFreePlan: boolean;
  lists: Array<{ id: string; name: string }> | undefined;
  cachedScores: Record<string, number>;
  evaluatingUsername: string | null;
  evalLoading: boolean;
  canUseAI: () => boolean;
  navigate: ReturnType<typeof useNavigate>;
  evaluateInfluencer: (params: {
    username: string; platform: string;
    followers?: number; snippet?: string;
    title?: string; link?: string;
  }) => Promise<{ overall_score: number } | null>;
  setEvaluatingUsername: (v: string | null) => void;
  setCachedScores: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  handleAddToList: (listId: string, result: SearchResult) => Promise<void>;
  setPendingAddResult: (r: SearchResult | null) => void;
  setShowCreateList: (v: boolean) => void;
}

function ResultCard({ c, isFreePlan, lists, cachedScores, evaluatingUsername, evalLoading, canUseAI, navigate, evaluateInfluencer, setEvaluatingUsername, setCachedScores, handleAddToList, setPendingAddResult, setShowCreateList }: ResultCardProps) {
  const displayName = c.full_name || c.title || c.username;
  const initials = displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "?";
  const city = c.city_extracted || c.city;
  return (
    <div
      data-testid="result-card"
      data-username={c.username}
      data-platform={c.platform}
      className={`bg-background/80 backdrop-blur-md border border-white/50 shadow-sm glass-card-hover rounded-2xl p-5 transition-all duration-300 relative ${isFreePlan ? "blur-sm pointer-events-none select-none" : ""}`}
    >
      {c.is_enriched && (
        <div className="absolute -top-3 -right-2 pointer-events-none">
          <Badge className="bg-green-500 hover:bg-green-600 shadow-sm gap-1 px-2 py-0.5 pointer-events-none">
            <ShieldCheck className="h-3 w-3" /> Verified
          </Badge>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate(`/influencer/${c.platform.toLowerCase()}/${c.username.replace("@", "")}`, { state: { from: window.location.search } })}>

          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase overflow-hidden flex-shrink-0 shadow-[0_0_0_2px_hsl(var(--primary)/0.1)]">
            {c.imageUrl
              ? <img src={c.imageUrl} alt={displayName} className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              : <span>{initials}</span>
            }
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">@{c.username.replace("@", "")}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
              <MoreHorizontal size={14} strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={c.link} target="_blank" rel="noopener noreferrer" className="cursor-pointer flex items-center">
                <ExternalLink className="h-4 w-4 mr-2" /> View Profile
              </a>
            </DropdownMenuItem>
            {canUseAI() && (
              <DropdownMenuItem
                disabled={evalLoading && evaluatingUsername === c.username}
                onClick={async () => {
                  setEvaluatingUsername(c.username);
                  const result = await evaluateInfluencer({
                    username: c.username, platform: c.platform,
                    followers: c.extracted_followers, snippet: c.snippet,
                    title: c.title, link: c.link,
                  });
                  if (result) {
                    setCachedScores((prev: any) => ({ ...prev, [`${c.platform} - ${c.username}`]: result.overall_score }));
                  }
                  setEvaluatingUsername(null);
                }}
              >
                {evalLoading && evaluatingUsername === c.username
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Sparkles className="h-4 w-4 mr-2 text-primary" />}
                AI Evaluate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs font-medium text-muted-foreground uppercase tracking-wider" disabled>
              Add to List
            </DropdownMenuItem>
            {lists?.map((list: any) => (
              <DropdownMenuItem key={list.id} onClick={() => handleAddToList(list.id, c)}>
                {list.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => { setPendingAddResult(c); setShowCreateList(true); }}>
              <Plus className="h-4 w-4 mr-2 text-primary" />
              <span className="text-primary">Create New List</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span data-testid="card-platform" className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 flex items-center gap-1">
          <PlatformIcon platform={c.platform} /> {c.platform}
        </span>
        {c.niche && (
          <span
            data-testid="card-niche"
            className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium"
            style={{ opacity: c.niche_confidence != null ? Math.max(0.5, c.niche_confidence) : 1 }}
            title={c.niche_confidence != null ? `Niche confidence: ${Math.round(c.niche_confidence * 100)}%` : undefined}
          >
            {c.niche}
          </span>
        )}
        {city && (
          <span data-testid="card-city" className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" />{city}
          </span>
        )}
        {/* Quality tier badge (Phase 5) */}
        {(() => {
          const qt = getQualityTier(c._search_score);
          return qt ? (
            <span
              data-testid="card-quality-tier"
              className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${qt.colorClass}`}
              title={`Relevance tier based on multi-factor ranking score (${c._search_score != null ? Math.round(c._search_score * 100) : "?"}%)`}
            >
              {qt.label}
            </span>
          ) : null;
        })()}
        {/* Verified contact marker */}
        {c.contact_email && (
          <span
            data-testid="card-verified-contact"
            className="text-[10px] font-semibold rounded-full px-2 py-0.5 border bg-violet-500/10 text-violet-400 border-violet-500/20"
            title="Verified contact email found in profile"
          >
            ✉ Contact
          </span>
        )}
      </div>

      {/* Creator topic tags */}
      {c.tags && c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {c.tags.slice(0, 5).map(tag => (
            <span key={tag} className="text-[10px] bg-muted/80 text-muted-foreground rounded px-1.5 py-0.5 font-mono">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {c.bio && (
        <div className="mb-3 text-xs text-muted-foreground/80 line-clamp-2">
          {c.bio}
        </div>
      )}

      {c.contact_email && (
        <div className="mb-3">
          <a
            href={`mailto:${c.contact_email}`}
            className="text-xs text-primary/80 hover:text-primary truncate flex items-center gap-1 max-w-full"
            title={c.contact_email}
            onClick={e => e.stopPropagation()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0">
              <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
              <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
            </svg>
            <span className="truncate">{c.contact_email}</span>
          </a>
        </div>
      )}

      {/* Show social links OR contact unavailable notice for enriched profiles */}
      {c.social_links && c.social_links.length > 0 ? (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {c.social_links.map((url) => {
            const isIG = url.includes("instagram.com");
            const isYT = url.includes("youtube.com");
            const isTT = url.includes("tiktok.com");
            const isTW = url.includes("x.com") || url.includes("twitter.com");
            const isFB = url.includes("facebook.com") || url.includes("fb.com");
            const label = isIG ? "Instagram" : isYT ? "YouTube" : isTT ? "TikTok" : isTW ? "X" : isFB ? "Facebook" : "Social";
            return (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 border border-border/60 rounded-full px-2 py-0.5 hover:border-primary/40 transition-colors"
              >
                {isIG && <Instagram className="h-2.5 w-2.5 text-pink-500 mr-0.5" />}
                {isYT && <Youtube className="h-2.5 w-2.5 text-red-500 mr-0.5" />}
                {isTT && <span className="text-[8px] font-bold mr-0.5">TT</span>}
                {isTW && <span className="text-[8px] font-bold mr-0.5">X</span>}
                {isFB && <span className="text-[8px] font-bold mr-0.5">FB</span>}
                {label}
              </a>
            );
          })}
        </div>
      ) : c.is_enriched && !c.contact_email ? (
        <p className="mb-3 text-[10px] text-muted-foreground/50 italic">Contact information unavailable</p>
      ) : null}

      <div className="grid grid-cols-3 gap-2 text-center mt-4 border-t border-border/50 pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Followers</p>
          <p data-testid="card-followers" className="text-sm font-semibold text-foreground data-mono">
            {c.extracted_followers ? formatFollowers(c.extracted_followers) : "—"}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1">
            <p className="text-xs text-muted-foreground">Engagement</p>
          </div>
          <p data-testid="card-engagement" className="text-sm font-semibold text-foreground data-mono">
            {c.engagement_rate != null ? `${c.engagement_rate.toFixed(1)}%` : "—"}
          </p>
          <div className="flex justify-center mt-1">
            {/* Engagement accuracy badge */}
            {c.is_enriched && (
              <span
                title={c.is_stale
                  ? `Real data from enrichment but over ${c.enrichment_ttl_days ?? 30} days old. Re-enrich for fresh data.`
                  : `Verified real engagement rate from ${c.last_enriched_at ? new Date(c.last_enriched_at).toLocaleDateString() : "recent"} enrichment`
                }
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-help ${
                  c.is_stale
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {c.is_stale ? "STALE" : "REAL"}
              </span>
            )}
            {!c.is_enriched && c.engagement_source === "benchmark_estimate" && (
              <span
                title={`Industry benchmark for ${c.engagement_benchmark_bucket ?? "this"}-tier ${c.platform} accounts. Enrich for real data.`}
                className="text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded cursor-help"
              >
                BENCHMARK
              </span>
            )}
            {!c.is_enriched && c.engagement_source !== "benchmark_estimate" && (
              <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                EST
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Relevance</p>
          {c._search_score != null ? (
            <div className="mt-1">
              <p
                className="text-sm font-semibold text-foreground data-mono cursor-help"
                title={`Score: ${Math.round(c._search_score * 100)}%\nSignals: keyword match, snippet relevance, engagement, authenticity, recency${c._intent ? `, intent (${c._intent.replace("_", " ")})` : ""}`}
              >
                {Math.round(c._search_score * 100)}%
              </p>
              <div className="h-1 bg-muted/50 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    c._search_score >= 0.65
                      ? "bg-emerald-500"
                      : c._search_score >= 0.35
                      ? "bg-amber-400"
                      : "bg-muted-foreground/40"
                  }`}
                  style={{ width: `${Math.round(c._search_score * 100)}%` }}
                />
              </div>
              {cachedScores[`${c.platform} - ${c.username}`] != null && (
                <div className="flex justify-center mt-1.5">
                  <EvaluationScoreBadge score={cachedScores[`${c.platform} - ${c.username}`]} size="sm" />
                </div>
              )}
            </div>
          ) : (
            /* Fallback for cached results without _search_score */
            cachedScores[`${c.platform} - ${c.username}`] != null ? (
              <div className="flex justify-center mt-1">
                <EvaluationScoreBadge score={cachedScores[`${c.platform} - ${c.username}`]} size="sm" />
              </div>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground/40 mt-1">&mdash;</p>
            )
          )}
        </div>
      </div>

      {/* View Profile CTA */}
      <Button
        size="sm"
        variant="outline"
        className="w-full mt-4 rounded-xl text-xs gap-1.5 border-border hover:border-primary/50 hover:text-primary"
        onClick={() => navigate(`/influencer/${c.platform.toLowerCase()}/${c.username.replace("@", "")}`, { state: { from: window.location.search } })}
      >
        <ExternalLink className="h-3 w-3" /> View Profile
      </Button>
    </div>
  );
}
