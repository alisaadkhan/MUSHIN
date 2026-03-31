import React from "react";
import { Link } from "react-router-dom";
import { Plus, LayoutDashboard, Radio, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";

// Modularized Components
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { ActivityList } from "@/components/dashboard/ActivityList";
import { CampaignsTable } from "@/components/dashboard/CampaignsTable";
import { GlassCard } from "@/components/ui/glass-card";

export default function Index() {
  const { profile } = useAuth();
  const { 
    campaigns, 
    recentActivity, 
    activityTrend, 
    stats, 
    isLoading, 
    isError, 
    isEmpty,
    refetch
  } = useDashboardData();

  const firstName = profile?.full_name?.split(" ")[0] || "Operator";

  if (isError) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
          <ShieldAlert size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Sync Interface Disrupted</h2>
          <p className="text-sm text-white/40 mt-2 max-w-sm mx-auto">
            The data uplink encountered a critical failure. Verify network integrity and attempt re-initialization.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()} 
          className="h-12 px-8 border-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest"
        >
          <RefreshCw size={14} className="mr-2" /> Re-initialize Uplink
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 animate-in fade-in duration-700">
      {/* ── Intelligence Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <LayoutDashboard size={18} />
             </div>
             <h1 className="text-3xl font-black text-white tracking-tighter uppercase" style={{ fontFamily:"'Syne', sans-serif" }}>
                Command Center
             </h1>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 flex items-center gap-2">
            <Radio size={12} className="animate-pulse text-purple-500" /> Authorized Access: {profile?.full_name || "Protocol Active"}
          </p>
        </div>
        <div className="flex items-center gap-3">
           <Button asChild variant="outline" className="h-11 border-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest px-6 shadow-xl">
              <Link to="/history">Intelligence Log</Link>
           </Button>
           <Button asChild className="h-11 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest px-8 shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:scale-105 transition-all">
              <Link to="/search">
                <Sparkles size={14} className="mr-2" /> Initiate Discovery
              </Link>
           </Button>
        </div>
      </div>

      {/* ── Primary KPI Nodes ─── */}
      <DashboardMetrics 
        stats={{
          ...stats,
          campaignsCount: campaigns.length
        }} 
        isLoading={isLoading} 
      />

      {/* ── Operational Grid ─── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <ActivityChart 
          data={activityTrend} 
          totalEvents={stats.totalEvents} 
          isLoading={isLoading} 
        />
        <ActivityList 
          activities={recentActivity} 
          isLoading={isLoading} 
        />
      </div>

      {/* ── Strategy Pipeline ─── */}
      <CampaignsTable 
        campaigns={campaigns} 
        isLoading={isLoading} 
      />

      {/* ── Metadata Persistence ─── */}
      <div className="flex items-center justify-between pt-10 border-t border-white/[0.03]">
         <div className="flex items-center gap-6">
            <div className="space-y-1">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Operational Uplink</p>
               <p className="text-[10px] font-bold text-white/40">Status: Stable</p>
            </div>
            <div className="w-px h-6 bg-white/[0.05]" />
            <div className="space-y-1">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Encryption Cluster</p>
               <p className="text-[10px] font-bold text-white/40">AES-256 GCM</p>
            </div>
         </div>
         <p className="text-[10px] font-black uppercase tracking-widest text-white/10">MUSHIN CLUSTER 4.0.2</p>
      </div>
    </div>
  );
}
