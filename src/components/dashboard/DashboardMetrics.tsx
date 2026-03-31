import React from "react";
import { Users, Eye, TrendingUp, DollarSign } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

interface DashboardMetricsProps {
  stats: {
    activeCreators: number;
    totalBudget: number;
    totalEvents: number;
    campaignsCount: number;
  };
  isLoading: boolean;
}

export function DashboardMetrics({ stats, isLoading }: DashboardMetricsProps) {
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();

  const metrics = [
    { 
      label: "Active Creators", 
      value: stats.activeCreators > 0 ? stats.activeCreators.toLocaleString() : "—", 
      icon: Users,
      glow: true 
    },
    { 
      label: "Campaign Budget", 
      value: stats.totalBudget > 0 ? `$${(stats.totalBudget / 1000).toFixed(1)}K` : "—", 
      icon: DollarSign 
    },
    { 
      label: "Live Campaigns", 
      value: stats.campaignsCount > 0 ? stats.campaignsCount.toLocaleString() : "—", 
      icon: TrendingUp 
    },
    { 
      label: "Intelligence Events", 
      value: stats.totalEvents > 0 ? stats.totalEvents.toLocaleString() : "—", 
      icon: Eye 
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <GlassCard key={i} intensity="low" className="p-6">
            <Skeleton className="h-3 w-24 mb-4 bg-white/5" />
            <Skeleton className="h-8 w-16 bg-white/5" />
          </GlassCard>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" onMouseMove={onMouseMove}>
      {metrics.map((m) => (
        <GlassCard 
          key={m.label} 
          intensity="low" 
          interactive
          className="p-6 relative group"
          mouseX={mouseX}
          mouseY={mouseY}
        >
          <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">{m.label}</span>
            <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-white/20 group-hover:text-purple-400 group-hover:border-purple-500/20 transition-colors">
              <m.icon size={14} strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tighter tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>
            {m.value}
          </div>
          {m.glow && (
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/20 transition-colors" />
          )}
        </GlassCard>
      ))}
    </div>
  );
}
