import React from "react";
import { TrendingUp, BarChart3, ShieldAlert, Sparkles, RefreshCw, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";

// Modularized Components
import { AnalyticsMetrics } from "@/components/analytics/AnalyticsMetrics";
import { AnalyticsCharts } from "@/components/analytics/AnalyticsCharts";
import { NicheLeaderboard } from "@/components/analytics/NicheLeaderboard";
import { GlassCard } from "@/components/ui/glass-card";

export default function AnalyticsPage() {
  const { 
    campaigns, 
    creditsUsage, 
    platformData, 
    campaignPerformance, 
    nicheData, 
    roiMetrics, 
    isLoading, 
    isError,
    refetch 
  } = useAnalyticsData();

  if (isError) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
          <ShieldAlert size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Telemetry Interface Offline</h2>
          <p className="text-sm text-white/40 mt-2 max-w-sm mx-auto">
            Analytical data ingestion has stalled. The telemetry pipeline is reporting a connectivity mismatch.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()} 
          className="h-12 px-8 border-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest"
        >
          <RefreshCw size={14} className="mr-2" /> Restart Data Uplink
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 animate-in fade-in duration-700">
      {/* ── Analytical Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <BarChart3 size={18} />
             </div>
             <h1 className="text-3xl font-black text-white tracking-tighter uppercase" style={{ fontFamily:"'Syne', sans-serif" }}>
                Intelligence Hub
             </h1>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 flex items-center gap-2">
            <Radio size={12} className="animate-pulse text-emerald-500" /> Operational Status: Synthesis Active
          </p>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" className="h-11 border-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest px-6 shadow-xl">
              Export Telemetry
           </Button>
        </div>
      </div>

      {/* ── Core KPI Synthesis ─── */}
      <AnalyticsMetrics 
        totalCreators={campaigns.reduce((sum, c) => sum + (c.pipeline_cards?.length || 0), 0)}
        totalClicks={roiMetrics.totalClicks}
        totalRevenue={roiMetrics.totalRevenue}
        roi={roiMetrics.roi}
        isLoading={isLoading}
      />

      {/* ── Multi-Vector Analytics ─── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <AnalyticsCharts 
             platformData={platformData}
             creditsUsage={creditsUsage}
             campaignPerformance={campaignPerformance}
             isLoading={isLoading}
           />
        </div>
        <div className="lg:col-span-1">
           <NicheLeaderboard 
             data={nicheData}
             isLoading={isLoading}
           />
        </div>
      </div>

      {/* ── System Information Node ─── */}
      <div className="flex items-center justify-between pt-10 border-t border-white/[0.03]">
         <div className="flex items-center gap-6">
            <div className="space-y-1">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Data Saturation</p>
               <p className="text-[10px] font-bold text-white/40">Density: Alpha-Level</p>
            </div>
            <div className="w-px h-6 bg-white/[0.05]" />
            <div className="space-y-1">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Query Processor</p>
               <p className="text-[10px] font-bold text-white/40">Active Nodes: {campaigns.length || 0}</p>
            </div>
         </div>
         <p className="text-[10px] font-black uppercase tracking-widest text-white/10">Telemetry v4.11.0</p>
      </div>
    </div>
  );
}
