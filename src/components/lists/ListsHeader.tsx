import React from "react";
import { Plus, LayoutList, Radio, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListsHeaderProps {
  onCreateClick: () => void;
}

export function ListsHeader({ onCreateClick }: ListsHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/[0.03]">
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
           <div className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-white/40">
              <LayoutList size={18} />
           </div>
           <h1 className="text-3xl font-black text-white tracking-tighter uppercase" style={{ fontFamily:"'Syne', sans-serif" }}>
              Curation Clusters
           </h1>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 flex items-center gap-2">
          <Radio size={12} className="animate-pulse text-purple-500" /> Operational Matrix: List Management Active
        </p>
      </div>
      <div className="flex items-center gap-3">
         <Button 
           onClick={onCreateClick}
           className="h-11 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest px-8 shadow-[0_0_30px_rgba(168,85,247,0.2)] hover:scale-105 transition-all active:scale-95"
         >
            <Plus size={14} className="mr-2" /> Initialize Cluster
         </Button>
      </div>
    </div>
  );
}
