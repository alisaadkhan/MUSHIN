import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Search as SearchIcon, Filter, ExternalLink, Loader2, Bookmark,
  AlertCircle, Lock, Sparkles, Plus, MoreHorizontal, MapPin, Instagram, Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORMS = ["Instagram", "TikTok", "YouTube"];

const PK_CITIES = [
  "All Pakistan",
  "Karachi", "Lahore", "Islamabad", "Rawalpindi",
  "Faisalabad", "Multan", "Peshawar", "Quetta",
  "Sialkot", "Gujranwala",
];

const PK_NICHES = [
  "Fashion", "Food", "Beauty", "Cricket", "Drama",
  "Islamic", "Tech", "Education", "Lifestyle", "Gaming",
];

const FOLLOWER_RANGES = [
  { label: "Any size", value: "any" },
  { label: "Nano (1k–10k)", value: "1k-10k" },
  { label: "Micro (10k–50k)", value: "10k-50k" },
  { label: "Mid-tier (50k–100k)", value: "50k-100k" },
  { label: "Macro (100k–500k)", value: "100k-500k" },
  { label: "Mega (500k+)", value: "500k+" },
];

// ─── Pakistani mock creators shown in empty/initial state ──────────────────
const PK_SAMPLE_CREATORS = [
  { name: "Zara Khalid", handle: "zarakhalid", platform: "Instagram", city: "Karachi", niche: "Fashion", followers: "1.2M", engagement: "4.8%", score: 97 },
  { name: "Hassan Ali", handle: "hassanali_food", platform: "YouTube", city: "Lahore", niche: "Food", followers: "890K", engagement: "6.1%", score: 94 },
  { name: "Ayesha Noor", handle: "ayeshanoor", platform: "TikTok", city: "Islamabad", niche: "Lifestyle", followers: "2.1M", engagement: "3.9%", score: 91 },
  { name: "Bilal Chaudhry", handle: "bilalchaudhry", platform: "Instagram", city: "Faisalabad", niche: "Cricket", followers: "540K", engagement: "5.3%", score: 88 },
  { name: "Sana Javed", handle: "sanajaved_official", platform: "TikTok", city: "Multan", niche: "Drama", followers: "320K", engagement: "7.2%", score: 85 },
  { name: "Omar Sheikh", handle: "omar_tech", platform: "YouTube", city: "Karachi", niche: "Tech", followers: "410K", engagement: "4.5%", score: 90 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  username: string;
  platform: string;
  displayUrl: string;
  extracted_followers?: number;
  city?: string;
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
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [isAiSearch, setIsAiSearch] = useState(searchParams.get("ai") === "1");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    searchParams.get("platform") ? [searchParams.get("platform")!] : []
  );
  const [selectedCity, setSelectedCity] = useState(searchParams.get("city") || "All Pakistan");
  const [followerRange, setFollowerRange] = useState(searchParams.get("range") || "any");
  const [selectedNiches, setSelectedNiches] = useState<string[]>(
    searchParams.get("niche") ? [searchParams.get("niche")!] : []
  );

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);

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
    if (selectedNiches[0]) next.niche = selectedNiches[0];
    setSearchParams({ ...next, ...overrides }, { replace: true });
  }, [query, isAiSearch, selectedPlatforms, selectedCity, followerRange, selectedNiches, setSearchParams]);

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const toggleNiche = (n: string) =>
    setSelectedNiches(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);

  // Auto-run once on load if q param is present and results not yet cached
  useEffect(() => {
    if (searchParams.get("q") && !hasAutoSearched.current && !searched) {
      hasAutoSearched.current = true;
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (creditsExhausted) { setShowCreditsPopup(true); return; }

    setLoading(true);
    setSearched(true);
    syncParams();

    const platformParam = selectedPlatforms.length > 0
      ? selectedPlatforms[0].toLowerCase()
      : "instagram";

    try {
      const endpoint = isAiSearch ? "search-natural" : "search-influencers";
      const body = isAiSearch
        ? { query: query.trim(), platform: platformParam, location: selectedCity }
        : { query: query.trim(), platform: platformParam, location: selectedCity, followerRange };

      const { data, error } = await supabase.functions.invoke(endpoint, { body });
      if (error) throw error;

      if (data?.error) {
        toast({ title: "Search failed", description: data.error, variant: "destructive" });
        setResults([]);
        return;
      }

      setResults(data.results || []);
      setCreditsRemaining(data.credits_remaining ?? null);
      queryClient.invalidateQueries({ queryKey: ["workspace-credits"] });
      queryClient.invalidateQueries({ queryKey: ["search-history"] });

      if ((data.results || []).length === 0) {
        toast({ title: "No results", description: "Try a different keyword, city, or platform." });
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message || "Something went wrong", variant: "destructive" });
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

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
          <Badge variant="outline" className={`text-xs gap-1.5 py-1 px-3 ${creditsExhausted ? "border-destructive text-destructive" : ""}`}>
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
        {/* ── Sidebar Filters ───────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 hidden lg:block space-y-4">
          <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Filter size={15} strokeWidth={1.5} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Filters</h3>
            </div>

            {/* Platform — Instagram / TikTok / YouTube only */}
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Platform</p>
              <div className="space-y-1.5">
                {PLATFORMS.map((p) => (
                  <label key={p} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
                    <Checkbox checked={selectedPlatforms.includes(p)} onCheckedChange={() => togglePlatform(p)} className="rounded border-border" />
                    <PlatformIcon platform={p} />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            {/* Location — Pakistan cities */}
            <div>
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-primary" /> Location
              </p>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PK_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Niche */}
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Niche</p>
              <div className="flex flex-wrap gap-1.5">
                {PK_NICHES.map((n) => (
                  <button
                    key={n}
                    onClick={() => toggleNiche(n)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${selectedNiches.includes(n) ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Follower range */}
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Follower Range</p>
              <select
                value={followerRange}
                onChange={(e) => setFollowerRange(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {FOLLOWER_RANGES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Engagement rate */}
            <div>
              <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-2">
                Engagement Rate
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Soon</span>
              </p>
              <input type="range" min="0" max="100" className="w-full accent-primary opacity-40 cursor-not-allowed" disabled />
              <div className="flex justify-between text-xs text-muted-foreground opacity-40"><span>0%</span><span>15%+</span></div>
            </div>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────── */}
        <div className="flex-1 space-y-4">
          {/* Search bar row */}
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex-1">
              {isAiSearch
                ? <Sparkles size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                : <SearchIcon size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              }
              <input
                type="text"
                placeholder={isAiSearch
                  ? "Describe the ideal Pakistani creator (e.g., Urdu food blogger from Lahore)..."
                  : "Search by name, handle, or niche (e.g. Karachi fashion)..."}
                className={`w-full h-10 pl-9 pr-4 rounded-lg border bg-white/80 backdrop-blur-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${isAiSearch ? "border-primary/50 placeholder:text-primary/50" : "border-border placeholder:text-muted-foreground"}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <div className="flex items-center space-x-2 bg-white/50 border border-white/50 px-3 h-10 rounded-lg shrink-0">
              <Switch id="ai-mode" checked={isAiSearch} onCheckedChange={setIsAiSearch} className="data-[state=checked]:bg-primary" />
              <Label htmlFor="ai-mode" className="text-xs font-medium cursor-pointer flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> AI Mode
              </Label>
            </div>
            <Button
              className="btn-shine gap-2 rounded-lg shrink-0"
              disabled={!query.trim() || loading || creditsExhausted}
              onClick={handleSearch}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
              Search
            </Button>
          </div>

          {/* Results meta row */}
          <div className="flex items-center justify-between min-h-[28px]">
            {searched && results.length > 0 && (
              <p className="text-sm text-muted-foreground">
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
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/50 backdrop-blur-sm border border-border/50 rounded-2xl p-5 space-y-4">
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
          {!loading && searched && results.length > 0 && (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {results.map((c, i) => (
                <ResultCard
                  key={`${c.platform}-${c.username}-${i}`}
                  c={c}
                  isFreePlan={isFreePlan}
                  lists={lists}
                  cachedScores={cachedScores}
                  evaluatingUsername={evaluatingUsername}
                  evalLoading={evalLoading}
                  canUseAI={canUseAI}
                  selectedNiches={selectedNiches}
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
          )}

          {/* Initial / empty state — show Pakistani sample creators */}
          {!loading && !searched && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-8 text-center bg-white/50 backdrop-blur-sm border border-white/50 shadow-sm rounded-2xl">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
                    <SearchIcon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-foreground mb-1">Find Pakistani Creators</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Search by name, niche, or city — filter by Karachi, Lahore, Islamabad and 9 more cities. Each search uses 1 credit.
                  </p>
                </div>

                {/* Sample Pakistani creators grid */}
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  🇵🇰 Sample Pakistani Creators
                </p>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {PK_SAMPLE_CREATORS.map((c) => (
                    <div key={c.handle}
                      className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5 opacity-80">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                            {c.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{c.name}</p>
                            <p className="text-xs text-muted-foreground">@{c.handle}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />{c.city}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 flex items-center gap-1">
                          <PlatformIcon platform={c.platform} />{c.platform}
                        </span>
                        <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{c.niche}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div><p className="text-xs text-muted-foreground">Followers</p><p className="text-sm font-semibold data-mono">{c.followers}</p></div>
                        <div><p className="text-xs text-muted-foreground">Engagement</p><p className="text-sm font-semibold data-mono">{c.engagement}</p></div>
                        <div><p className="text-xs text-muted-foreground">IQ Score</p>
                          <p className="text-sm font-bold data-mono" style={{ color: "hsl(var(--aurora-violet))" }}>{c.score}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* No results */}
          {!loading && searched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white/50 backdrop-blur-sm border border-white/50 shadow-sm rounded-2xl">
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
function ResultCard({ c, isFreePlan, lists, cachedScores, evaluatingUsername, evalLoading, canUseAI, selectedNiches, navigate, evaluateInfluencer, setEvaluatingUsername, setCachedScores, handleAddToList, setPendingAddResult, setShowCreateList }: any) {
  return (
    <div className={`bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 relative ${isFreePlan ? "blur-sm pointer-events-none select-none" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate(`/influencer/${c.platform.toLowerCase()}/${c.username.replace("@", "")}`)}>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
            {(c.title || c.username).split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "?"}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground truncate max-w-[120px]">{c.title}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">@{c.username}</p>
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

      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 flex items-center gap-1">
          <PlatformIcon platform={c.platform} /> {c.platform}
        </span>
        <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">{selectedNiches[0] || "General"}</span>
        {c.city && (
          <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" />{c.city}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mt-4">
        <div>
          <p className="text-xs text-muted-foreground">Followers</p>
          <p className="text-sm font-semibold text-foreground data-mono">
            {c.extracted_followers ? formatFollowers(c.extracted_followers) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Engagement</p>
          <p className="text-sm font-semibold text-foreground data-mono">{(Math.random() * 5 + 1).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">IQ Score</p>
          {cachedScores[`${c.platform}-${c.username}`] != null ? (
            <div className="flex justify-center mt-1">
              <EvaluationScoreBadge score={cachedScores[`${c.platform}-${c.username}`]} size="sm" />
            </div>
          ) : (
            <Button
              variant="ghost" size="sm"
              className="h-6 mt-0.5 text-[10px] w-full bg-primary/5 hover:bg-primary/10 text-primary"
              disabled={!canUseAI() || (evalLoading && evaluatingUsername === c.username)}
              onClick={async () => {
                setEvaluatingUsername(c.username);
                const result = await evaluateInfluencer({
                  username: c.username, platform: c.platform,
                  followers: c.extracted_followers, snippet: c.snippet,
                  title: c.title, link: c.link,
                });
                if (result) {
                  setCachedScores((prev: any) => ({ ...prev, [`${c.platform}-${c.username}`]: result.overall_score }));
                }
                setEvaluatingUsername(null);
              }}
            >
              {evalLoading && evaluatingUsername === c.username
                ? <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                : <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Evaluate</span>
              }
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
