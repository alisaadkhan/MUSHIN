import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, Instagram, Youtube, ExternalLink, Loader2, Plus, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerLists } from "@/hooks/useInfluencerLists";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

const PAKISTAN_CITIES = [
  "All Pakistan", "Karachi", "Lahore", "Islamabad",
  "Rawalpindi", "Faisalabad", "Peshawar", "Multan",
];

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "tiktok", label: "TikTok", icon: SlidersHorizontal },
  { value: "youtube", label: "YouTube", icon: Youtube },
];

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  username: string;
  platform: string;
  displayUrl: string;
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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Lists
  const { data: lists, createList } = useInfluencerLists();
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [pendingAddResult, setPendingAddResult] = useState<SearchResult | null>(null);

  // Save search
  const { saveSearch } = useSavedSearches();
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");

  // Auto-run if URL has params
  useEffect(() => {
    if (searchParams.get("q") && !searched) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke("search-influencers", {
        body: { query: query.trim(), platform, location: city },
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
            Added to <Link to={`/lists/${listId}`} className="underline font-medium">{listName}</Link>
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

  const PlatformIcon = PLATFORMS.find((p) => p.value === platform)?.icon || Search;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
          <p className="text-muted-foreground mt-1">Search for influencers across platforms</p>
        </div>
        {creditsRemaining !== null && (
          <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3">
            {creditsRemaining} credits left
          </Badge>
        )}
      </div>

      {/* Search Form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="niche" className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                  Niche / Keyword
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="niche"
                    placeholder='e.g. "fashion blogger", "fitness coach"'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10 bg-background/50"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2"><p.icon className="h-3.5 w-3.5" />{p.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Location</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAKISTAN_CITIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button className="btn-shine gap-2" disabled={!query.trim() || loading} onClick={handleSearch}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Searching…" : "Search Influencers"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && searched && results.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">{results.length} result{results.length !== 1 ? "s" : ""} found</p>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setShowSaveSearch(true)}>
              <Bookmark className="h-3 w-3" />
              Save Search
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((r, i) => (
              <motion.div
                key={`${r.platform}-${r.username}-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="glass-card hover:border-primary/30 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                          <PlatformIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{r.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{r.username}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${platformColors[r.platform] || ""}`}>
                        {r.platform}
                      </Badge>
                    </div>
                    {r.snippet && (
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{r.snippet}</p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
                        <a href={r.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                          View Profile
                        </a>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="text-xs gap-1.5">
                            <Plus className="h-3 w-3" />
                            Add to List
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
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
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
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

      {/* No results state */}
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
    </div>
  );
}
