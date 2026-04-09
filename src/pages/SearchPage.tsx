import React, { useState, useCallback, useEffect, useRef, useReducer, lazy, Suspense, useMemo } from "react";
import { SEO } from "@/components/SEO";
import {
  Search as SearchIcon, Filter, ExternalLink, Loader2, Bookmark,
  AlertCircle, Lock, Sparkles, Plus, MapPin,
  X as XIcon,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerLists } from "@/hooks/useInfluencerLists";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useInfluencerEvaluation } from "@/hooks/useInfluencerEvaluation";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { ResultCard, type SearchResult } from "@/components/search/ResultCard";
import { trackEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";

const CreateListDialog = lazy(() => import("@/components/search/dialogs/CreateListDialog"));
const SaveSearchDialog = lazy(() => import("@/components/search/dialogs/SaveSearchDialog"));
const CreditsDialog = lazy(() => import("@/components/search/dialogs/CreditsDialog"));

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
    <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors touch-manipulation ${
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

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === "instagram") return <span className="text-xs font-bold text-pink-500">IG</span>;
  if (p === "youtube") return <span className="text-xs font-bold text-red-500">YT</span>;
  if (p === "twitch") return <span className="text-xs font-bold" style={{ color: "#9147ff" }}>TV</span>;
  return <span className="text-xs font-bold text-foreground">TT</span>;
}

// ─── Cache key ───────────────────────────────────────────────────────────────
function buildCacheKey(q: string, platform: string | string[], city: string, range: string) {
  const pStr = Array.isArray(platform)
    ? [...platform].map(p => p.toLowerCase()).sort().join(",") || "instagram"
    : platform.toLowerCase();
  return `mushin_sr:${q.toLowerCase()}|${pStr}|${city}|${range}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── State types ──────────────────────────────────────────────────────────────
interface DialogState {
  showCreateList: boolean;
  showSaveSearch: boolean;
  showCreditsPopup: boolean;
  showMobileFilters: boolean;
  newListName: string;
  saveSearchName: string;
}

type DialogAction =
  | { type: "SET"; field: keyof DialogState; value: boolean | string }
  | { type: "RESET_ALL" };

const initialDialogState: DialogState = {
  showCreateList: false,
  showSaveSearch: false,
  showCreditsPopup: false,
  showMobileFilters: false,
  newListName: "",
  saveSearchName: "",
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "SET":
      return { ...state, [action.field]: action.value };
    case "RESET_ALL":
      return { ...initialDialogState };
    default:
      return state;
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  const [followerRange, setFollowerRange] = useState(searchParams.get("range") || "10k-50k");

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [evaluatingUsername, setEvaluatingUsername] = useState<string | null>(null);
  const [cachedScores, setCachedScores] = useState<Record<string, number>>({});
  const [pendingAddResult, setPendingAddResult] = useState<SearchResult | null>(null);

  const [dialogs, dispatchDialog] = useReducer(dialogReducer, initialDialogState);

  const { data: workspaceCredits } = useWorkspaceCredits();
  const { evaluate: evaluateInfluencer, loading: evalLoading } = useInfluencerEvaluation();
  const { canUseAI } = usePlanLimits();

  const creditsExhausted = workspaceCredits?.search_credits_remaining === 0;
  const isFreePlan = workspaceCredits?.plan === "free";

  const { data: lists, createList } = useInfluencerLists();
  const { saveSearch } = useSavedSearches();

  const hasAutoSearched = useRef(false);

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
          return;
        }
      } catch { /* corrupt cache — fall through */ }
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
    if (creditsExhausted) { dispatchDialog({ type: "SET", field: "showCreditsPopup", value: true }); return; }

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

      trackEvent("search_performed", {
        query: query.trim(),
        platforms: selectedPlatforms,
        city: selectedCity,
        followerRange,
        aiSearch: isAiSearch,
        resultsCount: sortedResults.length,
      });

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
      } catch { /* sessionStorage full */ }

      queryClient.invalidateQueries({ queryKey: ["workspace-credits"] });
      queryClient.invalidateQueries({ queryKey: ["search-history"] });

      trackEvent("credit_usage", {
        action: "search",
        creditsRemaining: creditsLeft,
      });
      logger.info("search", "Search completed", { query: query.trim(), results: sortedResults.length });

      if (sortedResults.length === 0) {
        toast({ title: "No results", description: "Try a different keyword, city, or platform." });
      }
    } catch (err: any) {
      logger.error("search", "Search failed", err);
      trackEvent("search_failed", { query: query.trim(), error: err.message });
      setSearchError(err.message || "Something went wrong");
      toast({ title: "Search failed", description: err.message || "Something went wrong", variant: "destructive" });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedPlatforms, creditsExhausted, isAiSearch, selectedCity, followerRange, toast, syncParams, queryClient]);

  const handleAddToList = useCallback(async (listId: string, result: SearchResult) => {
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
  }, [queryClient, toast]);

  const handleCreateListAndAdd = useCallback(async () => {
    if (!dialogs.newListName.trim() || !pendingAddResult) return;
    try {
      const newList = await createList.mutateAsync(dialogs.newListName.trim());
      await handleAddToList(newList.id, pendingAddResult);
      dispatchDialog({ type: "SET", field: "showCreateList", value: false });
      dispatchDialog({ type: "SET", field: "newListName", value: "" });
      setPendingAddResult(null);
    } catch {
      toast({ title: "Failed to create list", variant: "destructive" });
    }
  }, [dialogs.newListName, pendingAddResult, createList, handleAddToList, toast]);

  const handleSaveSearch = useCallback(async () => {
    if (!dialogs.saveSearchName.trim()) return;
    try {
      await saveSearch.mutateAsync({
        name: dialogs.saveSearchName.trim(),
        filters: { query, platform: selectedPlatforms[0] || "instagram", location: selectedCity },
      });
      toast({ title: "Search saved" });
      dispatchDialog({ type: "SET", field: "showSaveSearch", value: false });
      dispatchDialog({ type: "SET", field: "saveSearchName", value: "" });
    } catch {
      toast({ title: "Failed to save search", variant: "destructive" });
    }
  }, [dialogs.saveSearchName, query, selectedPlatforms, selectedCity, saveSearch, toast]);

  const activeFilterCount = useMemo(() =>
    selectedPlatforms.length + (selectedCity !== "All Pakistan" ? 1 : 0) + (followerRange !== "any" ? 1 : 0),
    [selectedPlatforms, selectedCity, followerRange]
  );

  return (
    <div className="space-y-6">
      <SEO title="Search Creators" description="Search verified Pakistani creators across Instagram, TikTok, and YouTube." noindex />
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
        <Sheet open={dialogs.showMobileFilters} onOpenChange={(v) => dispatchDialog({ type: "SET", field: "showMobileFilters", value: v })}>
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
              <Button className="w-full btn-shine" onClick={() => { dispatchDialog({ type: "SET", field: "showMobileFilters", value: false }); handleSearch(); }}>
                <SearchIcon className="h-4 w-4 mr-2" /> Apply &amp; Search
              </Button>
              <Button variant="outline" className="w-full" onClick={() => dispatchDialog({ type: "SET", field: "showMobileFilters", value: false })}>
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
                className={`w-full h-10 pl-9 pr-4 rounded-lg border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${isAiSearch ? "border-primary/50 placeholder:text-primary/50" : "border-border placeholder:text-muted-foreground"}`}
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
              onClick={() => dispatchDialog({ type: "SET", field: "showMobileFilters", value: true })}
              aria-label="Open filters"
            >
              <Filter size={16} strokeWidth={1.5} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-[10px] text-white flex items-center justify-center font-bold leading-none">
                  {activeFilterCount}
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
              <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-lg border-border" onClick={() => dispatchDialog({ type: "SET", field: "showSaveSearch", value: true })}>
                <Bookmark className="h-3 w-3" /> Save Search
              </Button>
            )}
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div data-testid="loading-state" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card/50 border border-border/50 rounded-2xl p-5 space-y-4">
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
                      setShowCreateList={(v) => dispatchDialog({ type: "SET", field: "showCreateList", value: v })}
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
            <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-2xl">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
                <SearchIcon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-foreground mb-1">Find Pakistani Creators</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Search by name, niche, or city — filter by Karachi, Lahore, Islamabad and 9 more cities. Each search uses 1 credit.
              </p>
            </div>
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
            <div data-testid="no-results" className="flex flex-col items-center justify-center py-20 text-center bg-card/50 border border-border rounded-2xl">
              <SearchIcon className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-serif text-lg font-semibold text-foreground mb-1">No Results Found</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Try different keywords, another city, or a broader platform selection.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Lazy-loaded Dialogs */}
      <Suspense fallback={null}>
        {dialogs.showCreateList && (
          <CreateListDialog
            open={dialogs.showCreateList}
            onOpenChange={(v) => dispatchDialog({ type: "SET", field: "showCreateList", value: v })}
            newListName={dialogs.newListName}
            setNewListName={(v) => dispatchDialog({ type: "SET", field: "newListName", value: v })}
            onCreate={handleCreateListAndAdd}
          />
        )}

        {dialogs.showSaveSearch && (
          <SaveSearchDialog
            open={dialogs.showSaveSearch}
            onOpenChange={(v) => dispatchDialog({ type: "SET", field: "showSaveSearch", value: v })}
            saveSearchName={dialogs.saveSearchName}
            setSaveSearchName={(v) => dispatchDialog({ type: "SET", field: "saveSearchName", value: v })}
            onSave={handleSaveSearch}
            isPending={saveSearch.isPending}
            query={query}
            selectedPlatforms={selectedPlatforms}
            selectedCity={selectedCity}
          />
        )}

        {dialogs.showCreditsPopup && (
          <CreditsDialog
            open={dialogs.showCreditsPopup}
            onOpenChange={(v) => dispatchDialog({ type: "SET", field: "showCreditsPopup", value: v })}
            isFreePlan={isFreePlan}
            creditsResetAt={workspaceCredits?.credits_reset_at}
            navigate={navigate}
          />
        )}
      </Suspense>
    </div>
  );
}
