import React from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

interface RecentActivity {
  action_type: string;
  amount: number;
  created_at: string;
}

interface ActivityListProps {
  activities: RecentActivity[];
  isLoading: boolean;
}

function formatAction(type: string) {
  const map: Record<string, string> = { 
    search: "Network Search Ingress", 
    enrich: "Profile Enrichment Active", 
    ai_insight: "Neural Insight Synthesis", 
    email_send: "Outreach Signal Dispatched", 
    evaluate: "Creator Node Evaluation" 
  };
  return map[type] || type.replace(/_/g, " ").toUpperCase();
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.round(d)}s`;
  if (d < 3600) return `${Math.round(d / 60)}m`;
  if (d < 86400) return `${Math.round(d / 3600)}h`;
  return `${Math.round(d / 86400)}d`;
}

export function ActivityList({ activities, isLoading }: ActivityListProps) {
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();

  if (isLoading) {
    return (
      <GlassCard className="p-8 h-[340px]">
        <Skeleton className="h-4 w-32 mb-8 bg-white/5" />
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-2 w-2 rounded-full bg-white/5 mt-1" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/2 bg-white/5" />
                <Skeleton className="h-2 w-1/4 bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard 
      intensity="low" 
      className="p-8 h-[340px] relative overflow-hidden group"
      onMouseMove={onMouseMove}
      mouseX={mouseX}
      mouseY={mouseY}
    >
      <div className="flex justify-between items-start mb-10">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">System Flux</h3>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400/50">Real-time</span>
      </div>

      <div className="space-y-6 overflow-y-auto h-[220px] scrollbar-none pr-2">
        {activities.length > 0 ? (
          activities.map((a, i) => (
            <div key={i} className="flex gap-4 group/item">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500/20 group-hover/item:bg-purple-500 mt-1 transition-all duration-300 shadow-[0_0_8px_rgba(168,85,247,0)] group-hover/item:shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-black uppercase tracking-widest text-white/80 group-hover/item:text-white transition-colors truncate">
                  {formatAction(a.action_type)}
                </div>
                <div className="flex items-center gap-2 mt-1">
                   <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">T-Minus {timeAgo(a.created_at)}</span>
                   <span className="w-0.5 h-0.5 rounded-full bg-white/10" />
                   <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">ID: {Math.random().toString(16).slice(2, 8)}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">No system events recorded.</p>
          </div>
        )}
      </div>
      
      {/* Background decoration */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/[0.02] rounded-full blur-[80px] pointer-events-none" />
    </GlassCard>
  );
}
