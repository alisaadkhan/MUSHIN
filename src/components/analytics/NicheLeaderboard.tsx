import React from "react";
import { TrendingUp, Award } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

interface AnalyticsNicheData {
  name: string;
  count: number;
}

interface NicheLeaderboardProps {
  data: AnalyticsNicheData[];
  isLoading: boolean;
}

export function NicheLeaderboard({ data, isLoading }: NicheLeaderboardProps) {
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();

  if (isLoading) {
    return (
      <GlassCard className="p-8 h-[360px]">
        <Skeleton className="h-4 w-32 mb-8 bg-white/5" />
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
             <div key={i} className="flex justify-between items-center pb-4 border-b border-white/[0.03]">
                <div className="flex items-center gap-4">
                   <Skeleton className="w-6 h-6 rounded-full bg-white/5" />
                   <Skeleton className="h-3 w-32 bg-white/5" />
                </div>
                <Skeleton className="h-3 w-16 bg-white/5" />
             </div>
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard 
      intensity="low" 
      className="p-8 h-[360px] relative overflow-hidden group"
      onMouseMove={onMouseMove}
      mouseX={mouseX}
      mouseY={mouseY}
    >
      <div className="flex justify-between items-start mb-10">
        <div className="flex items-center gap-3">
          <TrendingUp size={16} className="text-purple-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Niche Dominance Leaderboard</h3>
        </div>
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/10">Top Segments</span>
      </div>

      <div className="space-y-4">
        {data.length > 0 ? (
          data.map((n, i) => (
            <div key={n.name} className="flex items-center justify-between pb-4 border-b border-white/[0.03] last:border-0 group/item hover:bg-white/[0.01] transition-colors rounded-lg">
               <div className="flex items-center gap-4">
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-colors", 
                    i === 0 ? "bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]" : "bg-white/[0.02] text-white/20 border-white/5"
                  )}>
                    {i + 1}
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-white/60 group-hover/item:text-white transition-colors">{n.name}</div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="text-[14px] font-black text-white/40 group-hover/item:text-purple-400 transition-colors tabular-nums">
                    {n.count}
                    <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest ml-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">Nodes</span>
                  </div>
                  {i === 0 && <Award size={12} className="text-purple-400 animate-bounce" />}
               </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Strategy nodes pending saturation analysis.</p>
          </div>
        )}
      </div>

      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/[0.01] rounded-full blur-[80px] pointer-events-none" />
    </GlassCard>
  );
}

const cn = (...args: any[]) => args.filter(Boolean).join(" ");
