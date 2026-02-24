import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Instagram, Youtube, SlidersHorizontal, ExternalLink, Loader2, Plus, Bookmark, AlertCircle, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerLists } from "@/hooks/useInfluencerLists";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { EvaluationScoreBadge } from "@/components/influencer/EvaluationScoreBadge";
import { useInfluencerEvaluation } from "@/hooks/useInfluencerEvaluation";
import { usePlanLimits } from "@/hooks/usePlanLimits";

const PAKISTAN_CITIES = [
  "All Pakistan", "Karachi", "Lahore", "Islamabad",
  "Rawalpindi", "Faisalabad", "Peshawar", "Multan",
];

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "tiktok", label: "TikTok", icon: SlidersHorizontal },
  { value: "youtube", label: "YouTube", icon: Youtube },
];

const NICHES = ["Fashion", "Tech", "Beauty", "Fitness", "Food", "Travel", "Gaming", "Music"];

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  username: string;
  platform: string;
  displayUrl: string;
  extracted_followers?: number;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

const platformColors: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  tiktok: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  youtube: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [platform, setPlatform] = useState(searchParams.get("platform") || "instagram");
  const [city, setCity] = useState(searchParams.get("location") || "All Pakistan");
  const [followerRange, setFollowerRange] = useState("any");
  const [engagementRange, setEngagementRange] = useState([0, 15]);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: workspaceCredits } = useWorkspaceCredits();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (searchParams.get("q") && !searched) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (creditsExhausted) {
      setShowCreditsPopup(true);
      return;
    }
    setLoading(true);
    setSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke("search-influencers", {
        body: { query: query.trim(), platform, location: city, followerRange },
      });

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
        toast({ title: "No results", description: "Try a different keyword or platform." });
      }
    } catch (err: any) {
      console.error("Search error:", err);
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
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already in list", description: "This influencer is already in this list." });
        } else {
          throw error;
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["influencer-lists"] });
      const listName = lists?.find((l) => l.id === listId)?.name || "list";
      toast({
        title: "Added to list",
        description: (
          <span>
            Added to <a href={`/lists/${listId}`} className="underline font-medium">{listName}</a>
          </span>
        ),
      });
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
        filters: { query, platform, location: city },
      });
      toast({ title: "Search saved" });
      setShowSaveSearch(false);
      setSaveSearchName("");
    } catch {
      toast({ title: "Failed to save search", variant: "destructive" });
    }
  };

  const toggleNiche = (niche: string) => {
    setSelectedNiches(prev => prev.includes(niche) ? prev.filter(n => n !== niche) : [...prev, niche]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
          <p className="text-muted-foreground mt-1">Search for influencers across platforms</p>
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

      {/* Two-column layout: Filters + Results */}
      <div className="flex gap-6">
        {/* Left Filter Sidebar */}
        <div className="w-64 shrink-0 space-y-6 hidden lg:block">
          <Card className="glass-card">
            <CardContent className="p-5 space-y-6">
              {/* Platform */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">Platform</Label>
                <div className="space-y-2">
                  {PLATFORMS.map((p) => (
                    <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={platform === p.value}
                        onCheckedChange={() => setPlatform(p.value)}
                      />
                      <p.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Niche */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">Niche</Label>
                <div className="space-y-2">
                  {NICHES.map((niche) => (
                    <label key={niche} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedNiches.includes(niche)}
                        onCheckedChange={() => toggleNiche(niche)}
                      />
                      <span className="text-sm">{niche}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Engagement Range */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  Engagement Rate
                </Label>
                <Slider
                  value={engagementRange}
                  onValueChange={setEngagementRange}
                  max={15}
                  min={0}
                  step={0.5}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{engagementRange[0]}%</span>
                  <span>{engagementRange[1]}%+</span>
                </div>
              </div>

              {/* Location */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">Location</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAKISTAN_CITIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Followers */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">Followers</Label>
                <Select value={followerRange} onValueChange={setFollowerRange}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="1k-10k">1K – 10K</SelectItem>
                    <SelectItem value="10k-50k">10K – 50K</SelectItem>
                    <SelectItem value="50k-100k">50K – 100K</SelectItem>
                    <SelectItem value="100k+">100K+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full btn-shine gap-2" disabled={!query.trim() || loading || creditsExhausted} onClick={handleSearch}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Filter
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Search bar + Results */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search creators by name, handle, or niche…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10 bg-background/50"
              />
            </div>
            <Button className="btn-shine gap-2" disabled={!query.trim() || loading || creditsExhausted} onClick={handleSearch}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>

          {/* Mobile filters */}
          <div className="flex gap-2 flex-wrap lg:hidden">
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-auto bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="w-auto bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAKISTAN_CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Free plan banner */}
          {isFreePlan && searched && results.length > 0 && !bannerDismissed && (
            <Alert className="border-primary/30 bg-primary/5">
              <Lock className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>You're on the Free plan. Upgrade to see full influencer profiles.</span>
                <div className="flex items-center gap-2 ml-4">
                  <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => navigate("/billing")}>Upgrade</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setBannerDismissed(true)}>Dismiss</Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading */}
          {loading && (
            <Card className="glass-card">
              <CardContent className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Results Table */}
          {!loading && searched && results.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""} found</p>
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setShowSaveSearch(true)}>
                  <Bookmark className="h-3 w-3" />
                  Save Search
                </Button>
              </div>
              <Card className="glass-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Platform</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Followers</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, i) => {
                      const PIcon = PLATFORMS.find(p => p.value === r.platform)?.icon || Search;
                      return (
                        <TableRow key={`${r.platform}-${r.username}-${i}`} className={isFreePlan ? "blur-sm pointer-events-none select-none" : ""}>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${platformColors[r.platform] || ""}`}>
                              {r.platform}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                <PIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{r.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{r.username}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {r.extracted_followers ? (
                              <span className="text-sm font-medium">{formatFollowers(r.extracted_followers)}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right hidden sm:table-cell">
                            {cachedScores[`${r.platform}-${r.username}`] != null && (
                              <EvaluationScoreBadge score={cachedScores[`${r.platform}-${r.username}`]} size="sm" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                                <a href={r.link} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={!canUseAI() || (evalLoading && evaluatingUsername === r.username)}
                                onClick={async () => {
                                  setEvaluatingUsername(r.username);
                                  const result = await evaluateInfluencer({
                                    username: r.username,
                                    platform: r.platform,
                                    followers: r.extracted_followers,
                                    snippet: r.snippet,
                                    title: r.title,
                                    link: r.link,
                                  });
                                  if (result) {
                                    setCachedScores(prev => ({ ...prev, [`${r.platform}-${r.username}`]: result.overall_score }));
                                    navigate(`/influencer/${r.platform}/${r.username}`);
                                  }
                                  setEvaluatingUsername(null);
                                }}
                              >
                                {evalLoading && evaluatingUsername === r.username ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {lists && lists.length > 0 && (
                                    <>
                                      {lists.map((list) => (
                                        <DropdownMenuItem key={list.id} onClick={() => handleAddToList(list.id, r)}>
                                          {list.name}
                                        </DropdownMenuItem>
                                      ))}
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  <DropdownMenuItem onClick={() => { setPendingAddResult(r); setShowCreateList(true); }}>
                                    <Plus className="h-3 w-3 mr-2" />
                                    Create New List
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
              {isFreePlan && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Lock className="h-6 w-6 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium mb-2">Upgrade to Unlock Results</p>
                  <Button size="sm" className="text-xs" onClick={() => navigate("/billing")}>View Plans</Button>
                </div>
              )}
            </motion.div>
          )}

          {/* Empty / Initial State */}
          {!loading && !searched && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <Card className="glass-card">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl aurora-gradient mb-4">
                    <Search className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Start Your Search</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Enter a niche keyword, select a platform and location to discover real influencers with verified metrics.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* No results */}
          {!loading && searched && results.length === 0 && (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">No Results Found</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Try different keywords, another platform, or a broader location.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create List Dialog */}
      <Dialog open={showCreateList} onOpenChange={setShowCreateList}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New List</DialogTitle></DialogHeader>
          <Input
            placeholder="e.g. Summer Campaign 2026"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateListAndAdd()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateList(false)}>Cancel</Button>
            <Button onClick={handleCreateListAndAdd} disabled={!newListName.trim()}>Create & Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Search Dialog */}
      <Dialog open={showSaveSearch} onOpenChange={setShowSaveSearch}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save This Search</DialogTitle></DialogHeader>
          <Input
            placeholder="e.g. Gaming influencers in Karachi"
            value={saveSearchName}
            onChange={(e) => setSaveSearchName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
          />
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary">{query}</Badge>
            <Badge variant="outline">{platform}</Badge>
            <Badge variant="outline">{city}</Badge>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveSearch(false)}>Cancel</Button>
            <Button onClick={handleSaveSearch} disabled={!saveSearchName.trim() || saveSearch.isPending}>
              {saveSearch.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credits Exhausted Popup */}
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
            {isFreePlan ? " Upgrade to Pro for 500 credits per month." : " Credits reset daily."}
          </p>
          {workspaceCredits?.credits_reset_at && (
            <p className="text-xs text-muted-foreground">
              Credits reset on {format(new Date(workspaceCredits.credits_reset_at), "MMMM d, yyyy")}
            </p>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {isFreePlan && (
              <Button className="w-full btn-shine" onClick={() => { setShowCreditsPopup(false); navigate("/billing"); }}>
                Upgrade to Pro
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => setShowCreditsPopup(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
