import React from "react";
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { BarChart3, TrendingUp, Globe } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsChartsProps {
  platformData: any[];
  creditsUsage: any[];
  campaignPerformance: any[];
  isLoading: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0c0c14]/90 backdrop-blur-3xl border border-white/10 p-3 rounded-xl shadow-2xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-1">{label || "Node Intelligence"}</p>
        <p className="text-xl font-black text-white tabular-nums">{payload[0].value.toLocaleString()}</p>
        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20 mt-2">Captured Metric</p>
      </div>
    );
  }
  return null;
};

export function AnalyticsCharts({ platformData, creditsUsage, campaignPerformance, isLoading }: AnalyticsChartsProps) {
  
  if (isLoading) {
    return (
      <div className="grid lg:grid-cols-2 gap-6">
        {[1, 2, 3].map(i => (
          <GlassCard key={i} className="p-8 h-[360px]">
            <Skeleton className="h-4 w-32 mb-8 bg-white/5" />
            <Skeleton className="h-full w-full bg-white/5 rounded-xl" />
          </GlassCard>
        ))}
      </div>
    );
  }

  // Process search activity data
  const activityData = (() => {
    const byDay: Record<string, number> = {};
    creditsUsage.forEach((u: any) => {
      const day = (u.created_at || "").slice(0, 10);
      if (day) byDay[day] = (byDay[day] || 0) + 1;
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
        actions: count,
      }));
  })();

  const scatterData = campaignPerformance.map((c) => ({
    name: c.name,
    creators: c.total,
    conversion: c.rate,
  }));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Platform Intensity Breakdown */}
      <GlassCard intensity="low" className="p-8 h-[360px]">
        <div className="flex items-center gap-3 mb-10">
          <BarChart3 size={16} className="text-purple-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Platform Node Distribution</h3>
        </div>
        <div className="h-56">
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData} layout="vertical" margin={{ left: -20, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)", fontWeight: 900 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
                  {platformData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} className="transition-all duration-500" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] uppercase font-black tracking-widest text-white/10">No platform signals captured</div>
          )}
        </div>
      </GlassCard>

      {/* Network Activity Trajectory */}
      <GlassCard intensity="low" className="p-8 h-[360px]">
        <div className="flex items-center gap-3 mb-10">
          <TrendingUp size={16} className="text-purple-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Discovery Signal Velocity (30D)</h3>
        </div>
        <div className="h-56">
          {activityData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ left: -30, right: 0 }}>
                <defs>
                  <linearGradient id="anaEngGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontWeight: 900 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontWeight: 900 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="actions" stroke="#A855F7" fill="url(#anaEngGrad)" strokeWidth={3} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-full flex items-center justify-center text-[10px] uppercase font-black tracking-widest text-white/10">Zero activity events. Protocol idle.</div>
          )}
        </div>
      </GlassCard>

      {/* Strategy Conversion vs Reach Matrix */}
      <GlassCard intensity="low" className="p-8 h-[360px]">
        <div className="flex items-center gap-3 mb-10">
          <Globe size={16} className="text-purple-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Strategy Efficiency Cluster</h3>
        </div>
        <div className="h-56">
          {scatterData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: -20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="creators" name="Nodes" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontWeight: 900 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis dataKey="conversion" name="Conversion" unit="%" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontWeight: 900 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.05)", strokeWidth: 1 }} />
                <Scatter data={scatterData} fill="#A855F7" fillOpacity={0.6} className="transition-all duration-300 hover:fillOpacity-100" />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[10px] uppercase font-black tracking-widest text-white/10">Insufficient data for efficiency matrix</div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
