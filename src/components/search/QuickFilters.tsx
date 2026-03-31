import React from "react";
import { Filter, ChevronDown, Globe, Users, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLATFORMS, PK_CITIES, FOLLOWER_RANGES } from "@/modules/search/constants";
import { cn } from "@/lib/utils";

interface QuickFiltersProps {
  selectedPlatforms: string[];
  togglePlatform: (p: string) => void;
  selectedCity: string;
  setSelectedCity: (c: string) => void;
  followerRange: string;
  setFollowerRange: (r: string) => void;
  onAdvancedClick: () => void;
  hasAdvancedActive: boolean;
}

export function QuickFilters({
  selectedPlatforms,
  togglePlatform,
  selectedCity,
  setSelectedCity,
  followerRange,
  setFollowerRange,
  onAdvancedClick,
  hasAdvancedActive
}: QuickFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex items-center gap-2 p-1.5 bg-white/[0.02] border border-white/5 rounded-2xl scrollbar-none overflow-x-auto max-w-full shadow-inner ring-1 ring-white/[0.02]">
        {/* Platform Selection */}
        <div className="flex items-center gap-1.5 px-2">
           <Layout size={12} className="text-white/20 mr-1" />
           {PLATFORMS.map(p => (
             <button
               key={p}
               onClick={() => togglePlatform(p)}
               className={cn(
                 "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap",
                 selectedPlatforms.includes(p) 
                   ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                   : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]"
               )}
             >
               {p}
             </button>
           ))}
        </div>

        <div className="w-px h-5 bg-white/[0.05] mx-2" />

        {/* City Selection */}
        <div className="flex items-center gap-2 px-3 group/select relative">
           <Globe size={12} className="text-white/20" />
           <select 
             value={selectedCity} 
             onChange={e => setSelectedCity(e.target.value)}
             className="bg-transparent text-[9px] font-black uppercase tracking-[0.2em] text-white/40 px-2 py-1.5 outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-6"
           >
             {PK_CITIES.map(c => <option key={c} value={c} className="bg-[#0c0c14]">{c}</option>)}
           </select>
           <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover/select:text-white transition-colors" />
        </div>

        <div className="w-px h-5 bg-white/[0.05] mx-2" />

        {/* Follower Range */}
        <div className="flex items-center gap-2 px-3 group/select relative">
           <Users size={12} className="text-white/20" />
           <select 
             value={followerRange} 
             onChange={e => setFollowerRange(e.target.value)}
             className="bg-transparent text-[9px] font-black uppercase tracking-[0.2em] text-white/40 px-2 py-1.5 outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-6"
           >
             {FOLLOWER_RANGES.map(r => <option key={r.value} value={r.value} className="bg-[#0c0c14]">{r.label}</option>)}
           </select>
           <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover/select:text-white transition-colors" />
        </div>
      </div>

      {/* Advanced Filter Toggle */}
      <Button 
        variant="outline" 
        onClick={onAdvancedClick}
        className={cn(
          "h-12 rounded-2xl border-white/5 bg-white/[0.02] px-6 gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-purple-400 hover:border-purple-500/30 transition-all relative group shadow-sm active:scale-95",
          hasAdvancedActive && "border-purple-500/20 text-purple-400/80"
        )}
      >
        <Filter size={14} className={cn("transition-colors", hasAdvancedActive ? "text-purple-400" : "text-white/20 group-hover:text-purple-400/60")} /> 
        Advanced Filters
        {hasAdvancedActive && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)] border-2 border-[#0c0c14] animate-pulse" />
        )}
      </Button>
    </div>
  );
}
