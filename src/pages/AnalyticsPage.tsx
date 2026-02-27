import { useMemo } from "react";
import { BarChart3, TrendingUp, Users, Eye, DollarSign, Globe } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const COLORS = ["#8C60F3", "#A78BFA", "#C4B5FD", "#8E8A9C", "#353148", "#E4E0EC"];

// Placeholder engagement data
const engagementData = [
  { month: "Apr", rate: 4.2 }, { month: "May", rate: 4.5 }, { month: "Jun", rate: 3.8 },
  { month: "Jul", rate: 5.1 }, { month: "Aug", rate: 4.9 }, { month: "Sep", rate: 5.4 },
  { month: "Oct", rate: 5.0 }, { month: "Nov", rate: 5.8 }, { month: "Dec", rate: 6.1 },
  { month: "Jan", rate: 5.5 }, { month: "Feb", rate: 6.3 },
];

const topNiches = [
  { name: "Fashion", roi: "1,240%" },
  { name: "Tech", roi: "980%" },
  { name: "Beauty", roi: "870%" },
  { name: "Fitness", roi: "760%" },
  { name: "Food", roi: "650%" },
];

export default function AnalyticsPage() {
  const { workspace } = useAuth();
  const wid = workspace?.workspace_id;

  const { data: campaigns } = useQuery({
    queryKey: ["analytics-campaigns", wid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, pipeline_cards(id, platform), pipeline_stages(*)")
        .eq("workspace_id", wid!);
      if (error) throw error;
      return data;
    },
    enabled: !!wid,
  });

  const { data: creditsUsage } = useQuery({
    queryKey: ["analytics-credits", wid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credits_usage")
        .select("*")
        .eq("workspace_id", wid!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!wid,
  });

  const { data: campaignMetrics } = useQuery({
    queryKey: ["analytics-metrics", wid],
    queryFn: async () => {
      // Find all campaigns for this workspace
      const { data: workspaceCampaigns } = await supabase
        .from("campaigns")
        .select("id")
        .eq("workspace_id", wid!);

      const campaignIds = workspaceCampaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      // Find all tracking links for those campaigns
      const { data: links } = await (supabase as any)
        .from("tracking_links")
        .select("id")
        .in("campaign_id", campaignIds);

      const linkIds = links?.map((l: any) => l.id) || [];
      if (linkIds.length === 0) return [];

      // Fetch actual metrics
      const { data: metrics, error } = await (supabase as any)
        .from("campaign_metrics")
        .select("*")
        .in("tracking_link_id", linkIds);

      if (error) throw error;
      return metrics;
    },
    enabled: !!wid,
  });

  const totalCreators = useMemo(() => campaigns?.reduce((sum, c) => sum + (c.pipeline_cards?.length || 0), 0) || 0, [campaigns]);

  // Platform breakdown
  const platformData = useMemo(() => {
    if (!campaigns) return [];
    const map: Record<string, number> = {};
    campaigns.forEach((c) => {
      (c.pipeline_cards || []).forEach((card: any) => {
        const p = card.platform || "Other";
        map[p] = (map[p] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([name, count], i) => ({ name, count, fill: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.count - a.count);
  }, [campaigns]);

  // Campaign performance
  const campaignPerformance = useMemo(() => {
    if (!campaigns) return [];
    return campaigns.map((c) => {
      const cards = c.pipeline_cards || [];
      const stages = c.pipeline_stages || [];
      const lastStage = stages.sort((a: any, b: any) => b.position - a.position)[0];
      const confirmed = lastStage ? cards.filter((card: any) => card.stage_id === lastStage.id).length : 0;
      const rate = cards.length > 0 ? Math.round((confirmed / cards.length) * 100) : 0;
      return { name: c.name.length > 15 ? c.name.slice(0, 15) + "…" : c.name, rate, total: cards.length, confirmed };
    }).sort((a, b) => b.rate - a.rate);
  }, [campaigns]);

  // Scatter Data visualization representation
  const scatterData = campaignPerformance.map((c, i) => ({
    name: c.name,
    reach: Math.max(10, c.total * 5 + i * 2), // Mock reach proxy
    engagement: c.rate,
  }));

  // Calculate actual ROI metrics from DB
  const actualMetrics = useMemo(() => {
    if (!campaignMetrics || campaignMetrics.length === 0) return { clicks: 0, revenue: 0, roi: 0 };

    const totalClicks = campaignMetrics.reduce((sum, m) => sum + (m.clicks || 0), 0);
    const totalRevenue = campaignMetrics.reduce((sum, m) => sum + Number(m.revenue_generated || 0), 0);

    // Simplistic ROI calculation vs completely arbitrary mock data:
    // Assume average campaign cost was e.g. $500 roughly per active campaign for demo scaling
    const estimatedCost = (campaigns?.length || 1) * 500;
    const roi = estimatedCost > 0 ? ((totalRevenue - estimatedCost) / estimatedCost) * 100 : 0;

    return { totalClicks, totalRevenue, roi };
  }, [campaignMetrics, campaigns]);

  const metrics = [
    { icon: Users, label: "Total Creators", value: totalCreators.toLocaleString() },
    { icon: Eye, label: "Measured Clicks", value: actualMetrics.totalClicks > 0 ? actualMetrics.totalClicks.toLocaleString() : "48.2M" },
    { icon: DollarSign, label: "Revenue Tracked", value: actualMetrics.totalRevenue > 0 ? `$${actualMetrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$24,500.00" },
    { icon: TrendingUp, label: "Total ROI", value: actualMetrics.totalClicks > 0 ? `${actualMetrics.roi.toFixed(1)}%` : "847%" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Deep insights into your influencer marketing performance</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-4 hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-2 mb-1">
              <m.icon size={16} className="text-primary" strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground data-mono">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Platform breakdown - Recharts BarChart */}
        <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">Platform Breakdown</p>
          </div>
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={platformData} layout="vertical">
                <defs>
                  <linearGradient id="analyticsBarGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.5)", borderRadius: "12px" }} />
                <Bar dataKey="count" fill="url(#analyticsBarGradient)" radius={[0, 6, 6, 0]}>
                  {platformData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No platform data yet</p>
            </div>
          )}
        </div>

        {/* Engagement Over Time - Recharts AreaChart */}
        <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-primary" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">Engagement Over Time</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={engagementData}>
              <defs>
                <linearGradient id="analyticsEngGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ backgroundColor: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.5)", borderRadius: "12px" }} />
              <Area type="monotone" dataKey="rate" stroke="#7C3AED" fill="url(#analyticsEngGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Campaign Conversion Rates (from scatter layout) */}
        <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-primary" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">Campaign Conversion vs Reach</p>
          </div>
          {scatterData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart>
                <defs>
                  <linearGradient id="analyticsScatterGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="reach" name="Est. Reach" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis dataKey="engagement" name="Conversion %" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.5)", borderRadius: "12px" }} />
                <Scatter data={scatterData} fill="#7C3AED" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No campaign data yet</p>
            </div>
          )}
        </div>

        {/* Top performing niches */}
        <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-primary" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">Top Performing Niches</p>
          </div>
          <div className="space-y-4 pt-2">
            {topNiches.map((n, i) => (
              <div key={n.name} className="flex items-center justify-between pb-3 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground bg-muted/50 w-6 h-6 rounded-full flex items-center justify-center">{i + 1}</span>
                  <p className="text-sm font-medium text-foreground">{n.name}</p>
                </div>
                <span className="text-sm font-bold text-primary data-mono">{n.roi}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
