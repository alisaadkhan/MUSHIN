import React from "react";
import { useNavigate } from "react-router-dom";
import { Search, Radio, Fingerprint, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface SearchHeaderProps {
  creditsRemaining: number | null;
  creditsExhausted: boolean;
}

export function SearchHeader({ creditsRemaining, creditsExhausted }: SearchHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/[0.05]">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
           <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Search size={20} />
           </div>
           <h1 className="text-2xl font-black text-white tracking-tight uppercase" style={{ fontFamily:"'Syne', sans-serif" }}>
              Search Discovery
           </h1>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 ml-1">
          Explore and filter top creators across Pakistan
        </p>
      </div>
      
      <div className="flex items-center gap-4">
        {creditsRemaining !== null && (
          <Badge variant="outline" className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border-white/10 bg-white/[0.03] ${creditsExhausted ? "text-red-400 border-red-500/30" : "text-primary/80"}`}>
            <Activity size={10} className="mr-2" /> {creditsRemaining} Credits
          </Badge>
        )}
        <div className="w-px h-6 bg-white/[0.08]" />
        <Button variant="outline" size="sm" className="h-10 px-6 border-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest transition-all bg-white/[0.02]" onClick={() => navigate("/dashboard")}>
           Dashboard
        </Button>
        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/30">
           <Fingerprint size={20} />
        </div>
      </div>
    </div>
  );
}
