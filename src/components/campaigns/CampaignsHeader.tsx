import React from "react";
import { Link } from "react-router-dom";
import { Plus, BarChart2, Radio, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignsHeaderProps {
  onInitializeClick: () => void;
}

export function CampaignsHeader({ onInitializeClick }: CampaignsHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/[0.03]">
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
           <div className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-white/40">
              <Megaphone size={18} />
           </div>
           <h1 className="text-3xl font-black text-white tracking-tighter uppercase" style={{ fontFamily:"'Syne', sans-serif" }}>
              Strategy Nexus
           </h1>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 flex items-center gap-2">
          <Radio size={12} className="animate-pulse text-purple-500" /> Operational Matrix: Campaign Deployment Active
        </p>
      </div>
      <div className="flex items-center gap-3">
         <Button variant="outline" className="h-11 px-6 border-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest transition-all bg-white/[0.01]" asChild>
            <Link to="/campaigns/compare">
               <BarChart2 size={14} className="mr-2" /> Benchmarks
            </Link>
         </Button>
         <Button 
           onClick={onInitializeClick}
           className="h-11 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest px-8 shadow-[0_0_30px_rgba(168,85,247,0.2)] hover:scale-105 transition-all active:scale-95"
         >
            <Plus size={14} className="mr-2" /> Initialize Protocol
         </Button>
      </div>
    </div>
  );
}
