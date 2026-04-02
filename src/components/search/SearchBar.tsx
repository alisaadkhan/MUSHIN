import React from "react";
import { Search as SearchIcon, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

interface SearchBarProps {
  query: string;
  setQuery: (q: string) => void;
  onSearch: () => void;
  loading: boolean;
}

export function SearchBar({ query, setQuery, onSearch, loading }: SearchBarProps) {
  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-primary transition-colors">
        <SearchIcon size={20} />
      </div>
      <input
        type="text"
        placeholder="Search creators by name, handle, or niche..."
        className="w-full h-16 pl-14 pr-36 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-lg font-medium placeholder:text-white/10 focus:outline-none focus:border-primary/50 transition-all shadow-2xl"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
      />
      <div className="absolute right-2.5 top-2.5">
        <Button 
          onClick={onSearch} 
          disabled={loading || !query.trim()}
          className="h-11 px-8 rounded-xl btn-primary-alive text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <div className="flex items-center gap-2">
               <Zap size={14} className="fill-current" />
               Search
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}
