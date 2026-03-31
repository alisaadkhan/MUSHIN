import React from "react";
import { Users, Eye, DollarSign, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

interface AnalyticsMetricsProps {
  totalCreators: number;
  totalClicks: number;
  totalRevenue: number;
  roi: number;
  isLoading: boolean;
}

export function AnalyticsMetrics({ totalCreators, totalClicks, totalRevenue, roi, isLoading }: AnalyticsMetricsProps) {
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();

  const metrics = [
    { 
      label: "Total Creators", 
      value: totalCreators > 0 ? totalCreators.toLocaleString() : "—", 
      icon: Users 
    },
    { 
      label: "Intelligence Clicks", 
      value: totalClicks > 0 ? totalClicks.toLocaleString() : "—", 
      icon: Eye,
      detail: "Tracked via mushin_lnk"
    },
    { 
      label: "Attributed Revenue", 
      value: totalRevenue > 0 ? `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : "—", 
      icon: DollarSign,
      glow: true
    },
    { 
      label: "Engagement ROI", 
      value: totalClicks > 0 ? `${roi.toFixed(1)}%` : "—", 
      icon: TrendingUp 
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
            <div className={cn("p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] text-white/20 group-hover:text-purple-400 group-hover:border-purple-500/20 transition-colors", m.glow && "text-purple-400/50")}>
              <m.icon size={14} strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-3xl font-black text-white tracking-tighter tabular-nums" style={{ fontFamily: "'Syne', sans-serif" }}>
            {m.value}
          </div>
          {m.detail && (
            <div className="text-[9px] font-bold text-white/10 uppercase tracking-widest mt-2">
              {m.detail}
            </div>
          )}
          {m.glow && (
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/15 transition-colors" />
          )}
        </GlassCard>
      ))}
    </div>
  );
}

const cn = (...args: any[]) => args.filter(Boolean).join(" ");
