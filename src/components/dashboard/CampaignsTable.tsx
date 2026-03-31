import React from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronRight, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

interface DashboardCampaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  creators_count: number;
}

interface CampaignsTableProps {
  campaigns: DashboardCampaign[];
  isLoading: boolean;
}

const statusColors: Record<string, string> = { 
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", 
  draft: "text-amber-400 bg-amber-400/10 border-amber-400/20", 
  completed: "text-blue-400 bg-blue-400/10 border-blue-400/20" 
};

export function CampaignsTable({ campaigns, isLoading }: CampaignsTableProps) {
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();

  if (isLoading) {
    return (
      <GlassCard className="p-8">
        <Skeleton className="h-4 w-32 mb-8 bg-white/5" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full bg-white/5 rounded-xl" />)}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard 
      intensity="low" 
      className="overflow-hidden relative group/table"
      onMouseMove={onMouseMove}
      mouseX={mouseX}
      mouseY={mouseY}
    >
      <div className="px-8 py-6 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.01]">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Active Campaigns</h3>
          <p className="text-[9px] font-bold text-white/10 uppercase tracking-[0.1em] mt-1">Live Pipeline Status</p>
        </div>
        <Button asChild variant="outline" size="sm" className="h-9 border-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/[0.03]">
          <Link to="/campaigns"><Plus size={14} className="mr-2" /> New Strategy</Link>
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header */}
          <div className="grid grid-cols-[3fr_100px_100px_150px] px-8 py-4 text-[10px] font-black uppercase tracking-widest text-white/20 border-b border-white/[0.03]">
            <span>Campaign Vector</span>
            <span>Status</span>
            <span>Nodes</span>
            <span className="text-right">Budget Allocation</span>
          </div>

          {/* Body */}
          {campaigns.length > 0 ? (
            <div className="divide-y divide-white/[0.03]">
              {campaigns.map((c) => (
                <Link to={`/campaigns/${c.id}`} key={c.id} className="block group/row hover:bg-white/[0.02] transition-colors relative">
                  <div className="grid grid-cols-[3fr_100px_100px_150px] px-8 py-5 items-center">
                    <span className="text-sm font-black text-white/80 group-hover/row:text-white transition-colors tracking-tight uppercase">
                      {c.name}
                    </span>
                    <span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-current ${statusColors[c.status] || "text-white/40 border-white/10"}`}>
                        {c.status}
                      </span>
                    </span>
                    <span className="text-[11px] font-black text-white/40 tracking-widest flex items-center gap-2">
                       <TrendingUp size={12} className="text-purple-400 opacity-30" />
                       {c.creators_count}
                    </span>
                    <span className="text-right text-sm font-black text-white/60 tabular-nums tracking-tighter">
                      ${(c.budget / 1000).toFixed(1)}K
                    </span>
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 transition-opacity text-purple-400">
                     <ChevronRight size={16} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-8 py-20 text-center flex flex-col items-center justify-center">
               <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-white/10 mb-6">
                 <TrendingUp size={20} />
               </div>
               <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20 max-w-[200px]">
                 Initialize a campaign strategy to begin tracking intelligence nodes.
               </p>
               <Button asChild variant="outline" className="mt-8 border-purple-500/20 text-purple-400 hover:bg-purple-500/10 text-[10px] font-black uppercase tracking-widest">
                 <Link to="/campaigns">Launch Strategy</Link>
               </Button>
            </div>
          )}
        </div>
      </div>
      
      {/* Background decoration */}
      <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-purple-500/[0.01] rounded-full blur-[100px] pointer-events-none" />
    </GlassCard>
  );
}
