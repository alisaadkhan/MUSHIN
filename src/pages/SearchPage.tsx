import React, { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Trash2, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Hooks
import { useInfluencerLists } from "@/hooks/useInfluencerLists";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { useInfluencerEvaluation } from "@/hooks/useInfluencerEvaluation";
import { usePlanLimits } from "@/hooks/usePlanLimits";

// Components
import { SearchHeader } from "@/components/search/SearchHeader";
import { SearchBar } from "@/components/search/SearchBar";
import { QuickFilters } from "@/components/search/QuickFilters";
import { SearchGrid } from "@/components/search/SearchGrid";
import { FilterPanel } from "@/components/search/FilterPanel";
import { 
  PLATFORMS, PK_CITIES, PK_NICHES, FOLLOWER_RANGES, MAX_NICHES 
} from "@/modules/search/constants";

// Helpers
import { dedupeSearchResults, buildCacheKey } from "@/modules/search/search-utils";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [isAiSearch, setIsAiSearch] = useState(searchParams.get("ai") === "1");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    searchParams.get("platform") ? [searchParams.get("platform")!] : ["Instagram"]
  );
  const [selectedCity, setSelectedCity] = useState(searchParams.get("city") || "All Pakistan");
  const [followerRange, setFollowerRange] = useState(searchParams.get("range") || "any");
  const [engagementRange, setEngagementRange] = useState("any");
  const [contentLanguage, setContentLanguage] = useState("any");
  const [selectedNiches, setSelectedNiches] = useState<string[]>(
    searchParams.get("niche") ? searchParams.get("niche")!.split(",").filter(Boolean) : []
  );

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [tagFilter, setTagFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);

  const { data: workspaceCredits } = useWorkspaceCredits();
  const { evaluate: evaluateInfluencer, loading: evalLoading } = useInfluencerEvaluation();
  const { canUseAI } = usePlanLimits();
  const [evaluatingUsername, setEvaluatingUsername] = useState<string | null>(null);
  const [cachedScores, setCachedScores] = useState<Record<string, number>>({});

  const { data: lists, createList } = useInfluencerLists();
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [pendingAddResult, setPendingAddResult] = useState<any>(null);
  const { saveSearch } = useSavedSearches();
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");

  const creditsExhausted = workspaceCredits?.search_credits_remaining === 0;
  const isFreePlan = workspaceCredits?.plan === "free";
  const hasAutoSearched = useRef(false);
  const isSearchingRef = useRef(false);

  // Sync state to URL
  const syncParams = useCallback((overrides: Record<string, string> = {}) => {
    const next: Record<string, string> = {};
    if (query) next.q = query;
    if (isAiSearch) next.ai = "1";
    if (selectedPlatforms[0]) next.platform = selectedPlatforms[0];
    if (selectedCity !== "All Pakistan") next.city = selectedCity;
    if (followerRange !== "any") next.range = followerRange;
    if (selectedNiches.length > 0) next.niche = selectedNiches.join(",");
    setSearchParams({ ...next, ...overrides }, { replace: true });
  }, [query, isAiSearch, selectedPlatforms, selectedCity, followerRange, selectedNiches, setSearchParams]);

  const togglePlatform = (p: string) =>
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [p]);
  
  const toggleNiche = (n: string) =>
    setSelectedNiches(prev => {
      if (prev.includes(n)) return prev.filter(x => x !== n);
      if (prev.length >= MAX_NICHES) return prev;
      return [...prev, n];
    });

  const handleSearch = async () => {
    if (isSearchingRef.current || loading) return; // Strict debounce for rapid click
    
    if (!query.trim()) {
      toast({ title: "Input Required", description: "Please enter a search term.", variant: "destructive" });
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast({ title: "Signal Error", description: "Select at least one discovery node.", variant: "destructive" });
      return;
    }
    if (creditsExhausted) { toast({ title: "Cycle Restrict", description:"Credits exhausted." }); return; }

    isSearchingRef.current = true;
    setLoading(true);
    setSearched(true);
    setVisibleCount(12);
    syncParams();

    try {
      const platforms = selectedPlatforms.map(p => p.toLowerCase());
      const endpoint = isAiSearch ? "search-natural" : "search-influencers";
      const body = isAiSearch
          ? { query: query.trim(), platform: platforms[0], location: selectedCity }
          : { query: query.trim(), platform: platforms[0], location: selectedCity, followerRange, engagementRange, contentLanguage, niches: selectedNiches };

      const { data, error } = await supabase.functions.invoke(endpoint, { body });
      if (error) throw error;
      
      const sortedResults = dedupeSearchResults(data.results || []);
      setResults(sortedResults);
      setCreditsRemaining(data.credits_remaining ?? null);

      const cacheKey = buildCacheKey(query.trim(), platforms, selectedCity, followerRange);
      sessionStorage.setItem(cacheKey, JSON.stringify({ results: sortedResults, creditsRemaining: data.credits_remaining }));
      queryClient.invalidateQueries({ queryKey: ["workspace-credits"] });
    } catch (err: any) {
      toast({ title: "Spectrum Failure", description: err.message, variant: "destructive" });
    } finally {
      isSearchingRef.current = false;
      setLoading(false);
    }
  };


  useEffect(() => {
    if (searchParams.get("q") && !hasAutoSearched.current) {
      hasAutoSearched.current = true;
      handleSearch();
    }
  }, []);

  const handleAddToList = async (listId: string, result: any) => {
    try {
      const { error } = await supabase.from("list_items").insert({
        list_id: listId,
        username: result.username,
        platform: result.platform,
        data: { title: result.title, link: result.link, snippet: result.snippet, displayUrl: result.displayUrl },
      });
      if (error?.code === "23505") toast({ title: "Collision Detected", description: "Already in cluster." });
      else if (error) throw error;
      else {
        queryClient.invalidateQueries({ queryKey: ["influencer-lists"] });
        toast({ title: "Signal Isolated", description: `Added to ${listId}.` });
      }
    } catch { toast({ title: "Failed to Isolate", variant: "destructive" }); }
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) return;
    try {
      await saveSearch.mutateAsync({
        name: saveSearchName.trim(),
        filters: { query, platform: selectedPlatforms[0] || "instagram", location: selectedCity },
      });
      toast({ title: "Radar Configured", description: "Search vector mapped." });
      setShowSaveSearch(false);
      setSaveSearchName("");
    } catch { toast({ title: "Calibration Failed", variant: "destructive" }); }
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20 animate-in fade-in duration-700">
      {/* ── Search Topology Header ─── */}
      <SearchHeader 
        creditsRemaining={creditsRemaining} 
        creditsExhausted={creditsExhausted} 
      />

      {/* ── Functional Control HUD ─── */}
      <div className="flex flex-col gap-6">
         {creditsExhausted && (
           <Alert variant="destructive" className="bg-red-500/5 border-red-500/10 text-red-500 rounded-2xl">
             <AlertCircle className="h-4 w-4" />
             <AlertDescription className="text-[10px] font-black uppercase tracking-widest">
               Resource Exhaustion: Discovery Cycle Restricted.
             </AlertDescription>
           </Alert>
         )}

         <SearchBar 
           query={query} 
           setQuery={setQuery} 
           onSearch={handleSearch} 
           loading={loading} 
         />

         <div className="flex items-center justify-between">
            <QuickFilters 
              selectedPlatforms={selectedPlatforms}
              togglePlatform={togglePlatform}
              selectedCity={selectedCity}
              setSelectedCity={setSelectedCity}
              followerRange={followerRange}
              setFollowerRange={setFollowerRange}
              onAdvancedClick={() => setShowFilters(true)}
              hasAdvancedActive={selectedNiches.length > 0 || tagFilter !== ""}
            />
            {searched && results.length > 0 && (
              <Button 
                variant="ghost" 
                onClick={() => setShowSaveSearch(true)}
                className="h-10 text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-all"
              >
                Calibration Marker
              </Button>
            )}
         </div>
      </div>

      {/* ── Advanced Spectrum Sheet ─── */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-[#06060c]/90 border-l border-white/5 backdrop-blur-3xl p-0 flex flex-col">
          <SheetHeader className="p-8 border-b border-white/[0.03]">
            <SheetTitle className="text-xl font-black text-white uppercase tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>Spectrum Calibration</SheetTitle>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">Refine discovery vector metrics</p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-8">
            <FilterPanel 
              selectedPlatforms={selectedPlatforms} togglePlatform={togglePlatform}
              selectedCity={selectedCity} setSelectedCity={setSelectedCity}
              selectedNiches={selectedNiches} toggleNiche={toggleNiche}
              followerRange={followerRange} setFollowerRange={setFollowerRange}
              tagFilter={tagFilter} setTagFilter={setTagFilter}
              engagementRange={engagementRange} setEngagementRange={setEngagementRange}
              contentLanguage={contentLanguage} setContentLanguage={setContentLanguage}
              MAX_NICHES={MAX_NICHES} PLATFORMS={PLATFORMS} PK_CITIES={PK_CITIES} PK_NICHES={PK_NICHES} FOLLOWER_RANGES={FOLLOWER_RANGES}
            />
          </div>
          <SheetFooter className="p-8 border-t border-white/[0.03] bg-white/[0.01]">
            <Button className="w-full h-14 bg-purple-600 hover:bg-purple-500 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-purple-500/20" onClick={() => { setShowFilters(false); handleSearch(); }}>
              Recalibrate Results
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Operational Discovery Grid ─── */}
      <SearchGrid 
        results={results}
        visibleCount={visibleCount}
        setVisibleCount={setVisibleCount}
        loading={loading}
        searched={searched}
        isFreePlan={isFreePlan}
        lists={lists || []}
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

      {/* ── Modals ─── */}
      <Dialog open={showCreateList} onOpenChange={setShowCreateList}>
        <DialogContent className="bg-[#0c0c14] border-white/10 text-white p-8">
          <DialogHeader><DialogTitle className="uppercase font-black tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>Initialize Cluster</DialogTitle></DialogHeader>
          <div className="py-6">
             <input placeholder="e.g. Q4 Karachi Gaming Cluster" value={newListName} onChange={(e) => setNewListName(e.target.value)} className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-[13px] font-bold text-white focus:outline-none focus:border-purple-500/50" />
          </div>
          <DialogFooter>
             <Button onClick={async () => {
                if (!newListName.trim()) return;
                const newList = await createList.mutateAsync(newListName.trim());
                if (pendingAddResult) await handleAddToList(newList.id, pendingAddResult);
                setShowCreateList(false);
             }} className="h-12 bg-purple-600 hover:bg-purple-500 text-[10px] font-black uppercase tracking-widest flex-1">Create & Isolate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveSearch} onOpenChange={setShowSaveSearch}>
        <DialogContent className="bg-[#0c0c14] border-white/10 text-white p-8">
          <DialogHeader><DialogTitle className="uppercase font-black tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>Set Radar Marker</DialogTitle></DialogHeader>
          <div className="py-6">
             <input placeholder="e.g. Mega Karachi Influencers" value={saveSearchName} onChange={(e) => setSaveSearchName(e.target.value)} className="w-full h-12 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-[13px] font-bold text-white focus:outline-none focus:border-purple-500/50" />
          </div>
          <DialogFooter>
             <Button onClick={handleSaveSearch} className="h-12 bg-purple-600 hover:bg-purple-500 text-[10px] font-black uppercase tracking-widest flex-1">Configure Radar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
