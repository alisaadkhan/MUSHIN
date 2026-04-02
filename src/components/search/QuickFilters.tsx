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
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/10 rounded-2xl overflow-x-auto max-w-full shadow-inner ring-1 ring-white/[0.02]">
        {/* Platform Selection */}
        <div className="flex items-center gap-1 px-1">
           <Layout size={14} className="text-white/20 mr-2 ml-1" />
           {PLATFORMS.map(p => (
             <button
               key={p}
               onClick={() => togglePlatform(p)}
               className={cn(
                 "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                 selectedPlatforms.includes(p) 
                   ? "bg-primary text-white shadow-lg" 
                   : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
               )}
             >
               {p}
             </button>
           ))}
        </div>

        <div className="w-px h-5 bg-white/[0.1] mx-2" />

        {/* City Selection */}
        <div className="flex items-center gap-2 px-3 group/select relative">
           <Globe size={14} className="text-white/20" />
           <select 
             value={selectedCity} 
             onChange={e => setSelectedCity(e.target.value)}
             className="bg-transparent text-[10px] font-bold uppercase tracking-widest text-white/50 px-2 py-1.5 outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-6"
           >
             {PK_CITIES.map(c => <option key={c} value={c} className="bg-[#0c0c14]">{c}</option>)}
           </select>
           <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none group-hover/select:text-white transition-colors" />
        </div>

        <div className="w-px h-5 bg-white/[0.1] mx-2" />

        {/* Follower Range */}
        <div className="flex items-center gap-2 px-3 group/select relative border-r border-white/10 pr-4">
           <Users size={14} className="text-white/20" />
           <select 
             value={followerRange} 
             onChange={e => setFollowerRange(e.target.value)}
             className="bg-transparent text-[10px] font-bold uppercase tracking-widest text-white/50 px-2 py-1.5 outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-6"
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
          "h-12 rounded-2xl border-white/10 bg-white/[0.03] px-6 gap-3 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-primary hover:border-primary/50 transition-all shadow-sm active:scale-95",
          hasAdvancedActive && "border-primary/40 text-primary bg-primary/[0.03]"
        )}
      >
        <Filter size={14} className={cn("transition-colors", hasAdvancedActive ? "text-primary" : "text-white/40")} /> 
        Advanced Refinement
      </Button>
    </div>
  );
}
