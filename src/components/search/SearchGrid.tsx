import React from "react";
import { ResultCard } from "@/components/influencer/ResultCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, XCircle, ChevronDown, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchGridProps {
  results: any[];
  visibleCount: number;
  setVisibleCount: (n: (prev: number) => number) => void;
  loading: boolean;
  searched: boolean;
  isFreePlan: boolean;
  lists: any[];
  cachedScores: Record<string, number>;
  evaluatingUsername: string | null;
  evalLoading: boolean;
  canUseAI: () => boolean;
  selectedNiches: string[];
  navigate: any;
  evaluateInfluencer: (params: any, force?: boolean) => Promise<any>;
  setEvaluatingUsername: (u: string | null) => void;
  setCachedScores: (s: any) => void;
  handleAddToList: (listId: string, result: any) => Promise<void>;
  setPendingAddResult: (r: any) => void;
  setShowCreateList: (show: boolean) => void;
}

export function SearchGrid({
  results,
  visibleCount,
  setVisibleCount,
  loading,
  searched,
  isFreePlan,
  lists,
  cachedScores,
  evaluatingUsername,
  evalLoading,
  canUseAI,
  selectedNiches,
  navigate,
  evaluateInfluencer,
  setEvaluatingUsername,
  setCachedScores,
  handleAddToList,
  setPendingAddResult,
  setShowCreateList
}: SearchGridProps) {
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-96 rounded-3xl bg-white/[0.01] border border-white/5 p-6 animate-pulse space-y-4">
             <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-full bg-white/5" />
                <div className="space-y-2">
                   <Skeleton className="w-24 h-4 bg-white/5" />
                   <Skeleton className="w-16 h-3 bg-white/5" />
                </div>
             </div>
             <Skeleton className="w-full h-40 bg-white/5 rounded-2xl" />
             <Skeleton className="w-full h-10 bg-white/5 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (!searched) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center animate-in fade-in duration-1000">
        <div className="w-32 h-32 rounded-[2.5rem] bg-purple-500/5 border border-purple-500/10 flex items-center justify-center mb-10 shadow-[0_0_50px_rgba(168,85,247,0.05)]">
          <Sparkles className="w-12 h-12 text-purple-400 opacity-20" />
        </div>
        <h2 className="text-4xl font-black text-white/90 tracking-tighter uppercase" style={{ fontFamily: "'Syne', sans-serif" }}>Grid Initialization Pending</h2>
        <p className="text-white/20 max-w-sm mx-auto text-[10px] leading-relaxed uppercase tracking-[0.3em] font-black mt-4">
          Execute a query search to map the <span className="text-purple-400">verification node network</span> and activate discovery telemetry.
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center">
        <div className="w-24 h-24 rounded-3xl bg-white/[0.02] flex items-center justify-center mb-10 border border-white/5">
          <XCircle className="w-12 h-12 text-white/10" />
        </div>
        <h2 className="text-2xl font-black text-white/40 tracking-tighter uppercase" style={{ fontFamily: "'Syne', sans-serif" }}>No Intel Mapping</h2>
        <p className="text-[9px] text-white/20 uppercase tracking-[0.2em] font-black mt-2">Re-calibrate filtration parameters and synchronize signal</p>
      </div>
    );
  }

  const activeResults = results.slice(0, visibleCount);

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.3em] text-white/20 border-b border-white/[0.03] pb-4">
        <div className="flex items-center gap-3">
           <Radio size={12} className="text-purple-500" />
           {results.length} Verified Sources Detected
        </div>
        <p>Sorted by Neural Relevance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
        <AnimatePresence mode="popLayout">
          {activeResults.map((c, i) => (
            <motion.div
              key={`${c.platform}-${c.username}-${i}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <ResultCard
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
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {results.length > visibleCount && (
        <div className="flex justify-center pt-10">
          <Button 
            variant="outline" 
            onClick={() => setVisibleCount(p => p + 8)}
            className="px-16 h-14 rounded-3xl border-white/5 hover:border-purple-500/30 hover:bg-purple-500/[0.02] hover:text-purple-400 text-[10px] font-black uppercase tracking-[0.3em] transition-all group active:scale-95 shadow-xl"
          >
            <ChevronDown size={16} className="mr-3 group-hover:translate-y-1 transition-transform" />
            Expand Signal Spectrum
          </Button>
        </div>
      )}
    </div>
  );
}
