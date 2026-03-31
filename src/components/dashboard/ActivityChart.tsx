import React, { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

interface ActivityChartProps {
  data: { day: number; activity: number }[];
  totalEvents: number;
  isLoading: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0c0c14]/90 backdrop-blur-3xl border border-white/10 p-3 rounded-xl shadow-2xl">
        <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-1">Activity Node</p>
        <p className="text-xl font-black text-white tabular-nums">{payload[0].value.toLocaleString()} Events</p>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] mt-2">Day {payload[0].payload.day}</p>
      </div>
    );
  }
  return null;
};

export function ActivityChart({ data, totalEvents, isLoading }: ActivityChartProps) {
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();
  const hasActivity = useMemo(() => data.some((d) => d.activity > 0), [data]);

  if (isLoading) {
    return (
      <GlassCard className="lg:col-span-2 p-8 h-[340px]">
        <Skeleton className="h-4 w-32 mb-6 bg-white/5" />
        <Skeleton className="h-full w-full bg-white/5 rounded-xl" />
      </GlassCard>
    );
  }

  return (
    <GlassCard 
      intensity="low" 
      className="lg:col-span-2 p-8 h-[340px] relative overflow-hidden group"
      onMouseMove={onMouseMove}
      mouseX={mouseX}
      mouseY={mouseY}
    >
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-1">Network Activity</h3>
          <p className="text-xs font-bold text-white/60">Cross-platform intelligence events (30D)</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-purple-400 tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>
            {totalEvents}
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mt-1">Total Signals</p>
        </div>
      </div>

      <div className="h-48 w-full mt-4">
        {hasActivity ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -25 }}>
              <defs>
                <linearGradient id="actg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A855F7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontWeight: 900 }} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontWeight: 900 }} 
                tickLine={false} 
                axisLine={false} 
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(168,85,247,0.3)", strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Area 
                type="monotone" 
                dataKey="activity" 
                stroke="#A855F7" 
                strokeWidth={3} 
                fill="url(#actg)" 
                animationDuration={1500}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.05] flex items-center justify-center text-white/10">
              <BarChart3 size={20} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 max-w-[200px]">
              No activity signals detected in the 30-day window.
            </p>
          </div>
        )}
      </div>
      
      {/* Background decoration */}
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/[0.03] rounded-full blur-[100px] pointer-events-none" />
    </GlassCard>
  );
}

const cn = (...args: any[]) => args.filter(Boolean).join(" ");

import { BarChart3 } from "lucide-react";
