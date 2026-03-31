import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Trash2, Users, PieChart, ArrowRight, Activity, Target, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CampaignStatus = "draft" | "active" | "completed";

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget?: number;
  pipeline_cards?: { count: number }[];
}

interface CampaignKanbanProps {
  grouped: Record<CampaignStatus, Campaign[]>;
  onDelete: (id: string) => void;
}

const COLUMNS: { status: CampaignStatus; label: string; icon: any; color: string }[] = [
  { status: "draft", label: "Strategy & Draft", icon: Target, color: "text-white/40" },
  { status: "active", label: "Live Deployment", icon: Activity, color: "text-purple-400" },
  { status: "completed", label: "Execution Analysis", icon: CheckCircle2, color: "text-emerald-400" },
];

export function CampaignKanban({ grouped, onDelete }: CampaignKanbanProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
      {COLUMNS.map((col) => (
        <div key={col.status} className="flex flex-col gap-6">
          {/* Column Header */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <col.icon size={14} className={col.color} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">{col.label}</h3>
            </div>
            <Badge variant="outline" className="bg-white/[0.03] border-white/10 text-[9px] font-black text-white/20 rounded-lg px-2 h-5 tabular-nums">
              {grouped[col.status]?.length || 0}
            </Badge>
          </div>

          {/* Column Body */}
          <div className="flex-1 min-h-[500px] rounded-[2rem] border border-white/[0.05] bg-white/[0.01] p-4 space-y-4">
            {grouped[col.status]?.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/campaigns/${c.id}`} className="block group relative">
                   <GlassCard intensity="low" className="p-6 border-white/[0.05] group-hover:border-purple-500/30 group-hover:bg-white/[0.03] transition-all duration-300 relative overflow-hidden">
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => { e.preventDefault(); onDelete(c.id); }}
                          className="p-2 rounded-lg text-white/10 hover:text-red-400 hover:bg-red-400/10 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <h4 className="text-[13px] font-black text-white hover:text-purple-400 transition-colors uppercase tracking-tight pr-8 mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
                        {c.name}
                      </h4>

                      <div className="grid grid-cols-2 gap-4 border-t border-white/[0.03] pt-4">
                         <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-white/10 flex items-center gap-1.5">
                               <Users size={10} className="text-purple-400/40" /> Partners
                            </p>
                            <p className="text-[11px] font-bold text-white/40 tabular-nums">
                               {(c as any).pipeline_cards?.[0]?.count || 0} Nodes
                            </p>
                         </div>
                         <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-white/10 flex items-center gap-1.5">
                               <PieChart size={10} className="text-purple-400/40" /> Allocation
                            </p>
                            <p className="text-[11px] font-bold text-white/40 tabular-nums uppercase">
                               {c.budget ? `₨${Number(c.budget).toLocaleString()}` : "UNSET"}
                            </p>
                         </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                         <span className="text-[8px] font-black uppercase text-white/5 tracking-[0.2em]">ID_X: {c.id.slice(0, 8)}</span>
                         <ArrowRight size={14} className="text-white/5 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                      </div>
                   </GlassCard>
                </Link>
              </motion.div>
            ))}
            
            {(!grouped[col.status] || grouped[col.status].length === 0) && (
              <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/[0.05] rounded-3xl opacity-20">
                 <p className="text-[9px] font-black uppercase tracking-[0.3em]">Awaiting deployment</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
