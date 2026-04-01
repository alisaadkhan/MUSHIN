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
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();

  return (
    <div className="relative group" onMouseMove={onMouseMove}>
      <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-purple-400 transition-colors">
        <SearchIcon size={20} strokeWidth={2.5} />
      </div>
      <input
        type="text"
        placeholder="Search by name, handle, or niche..."
        className="w-full h-16 pl-16 pr-36 rounded-2xl bg-white/[0.03] border border-white/10 text-white text-lg font-black uppercase tracking-tight placeholder:text-white/10 focus:outline-none focus:border-purple-500/50 focus:ring-8 focus:ring-purple-500/5 transition-all"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
        style={{ fontFamily: "'Inter', sans-serif" }} // Better input reading
      />
      <div className="absolute right-2 sm:right-3 top-2 sm:top-2.5">
        <Button 
          onClick={onSearch} 
          disabled={loading || !query.trim()}
          className="h-12 w-12 sm:h-11 sm:w-auto sm:px-8 p-0 sm:p-auto rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(168,85,247,0.2)] active:scale-95 flex items-center justify-center"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <div className="flex items-center gap-2">
               <Zap size={14} className="fill-current" />
               <span className="hidden sm:inline">Run Intelligence</span>
            </div>
          )}
        </Button>
      </div>

      {/* Mouse Spotlight */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity rounded-2xl overflow-hidden"
        style={{
          background: `radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(168,85,247,0.05), transparent 80%)`,
        }}
      />
    </div>
  );
}
