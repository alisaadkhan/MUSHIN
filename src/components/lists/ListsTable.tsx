import React from "react";
import { Link } from "react-router-dom";
import { Trash2, Eye, Users, ChevronRight, Share2, MoreHorizontal } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

interface List {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  list_items?: { count: number }[];
}

interface ListsTableProps {
  lists: List[];
  isLoading: boolean;
  onDelete: (id: string) => void;
}

export function ListsTable({ lists, isLoading, onDelete }: ListsTableProps) {
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();

  if (isLoading) {
    return (
      <GlassCard className="p-8 h-[400px]">
        <Skeleton className="h-4 w-32 mb-8 bg-white/5" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full bg-white/5 rounded-xl" />)}
        </div>
      </GlassCard>
    );
  }

  if (lists.length === 0) {
    return (
      <GlassCard intensity="low" className="py-24 flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/10">
          <Users size={32} />
        </div>
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>No Curation Nodes Detected</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-2 max-w-xs mx-auto leading-relaxed">
            Initialize a curation cluster to begin organizing cross-platform intelligence vectors.
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard 
      intensity="low" 
      className="overflow-hidden border-white/[0.05] relative group/table"
      onMouseMove={onMouseMove}
      mouseX={mouseX}
      mouseY={mouseY}
    >
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="grid grid-cols-[3fr_100px_150px_150px_120px] px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white/20 border-b border-white/[0.03] bg-white/[0.01]">
            <span>Cluster Identity</span>
            <span>Saturation</span>
            <span>Initialization</span>
            <span>Last Sync</span>
            <span className="text-right">Operational Status</span>
          </div>

          {/* Body */}
          <div className="divide-y divide-white/[0.03]">
            {lists.map((list) => {
              const itemCount = (list as any).list_items?.[0]?.count ?? 0;
              return (
                <div key={list.id} className="group/row hover:bg-white/[0.02] transition-colors relative">
                   <div className="grid grid-cols-[3fr_100px_150px_150px_120px] px-8 py-6 items-center">
                      <Link to={`/lists/${list.id}`} className="flex flex-col">
                         <span className="text-sm font-black text-white/80 group-hover/row:text-white transition-colors tracking-tight uppercase">
                            {list.name}
                         </span>
                         <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest mt-1">ID: {list.id.slice(0, 8)}</span>
                      </Link>
                      
                      <div className="flex items-center gap-2">
                        <Users size={12} className="text-purple-400 opacity-30" />
                        <span className="text-[11px] font-black text-white/40 tabular-nums tracking-widest">{itemCount}</span>
                      </div>

                      <span className="text-[10px] font-black text-white/20 uppercase tracking-widest tabular-nums">
                        {format(new Date(list.created_at), "dd.MM.yy")}
                      </span>

                      <span className="text-[10px] font-black text-white/20 uppercase tracking-widest tabular-nums">
                        {format(new Date(list.updated_at), "dd.MM.yy")}
                      </span>

                      <div className="flex items-center justify-end gap-2">
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-white/10 hover:text-purple-400 hover:bg-purple-500/10" asChild>
                            <Link to={`/lists/${list.id}`}>
                               <Eye size={14} />
                            </Link>
                         </Button>
                         <button 
                           onClick={() => onDelete(list.id)}
                           className="h-8 w-8 flex items-center justify-center text-white/5 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                         >
                            <Trash2 size={14} />
                         </button>
                         <button className="h-8 w-8 flex items-center justify-center text-white/5 hover:text-white/20 transition-all">
                            <MoreHorizontal size={14} />
                         </button>
                      </div>
                   </div>
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 transition-opacity text-purple-400">
                      <ChevronRight size={16} />
                   </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Background decoration */}
      <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-purple-500/[0.01] rounded-full blur-[100px] pointer-events-none" />
    </GlassCard>
  );
}
