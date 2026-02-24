import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, LineChart, Line } from "recharts";
import { Users, Globe, TrendingUp, Search, Brain, BarChart3 } from "lucide-react";
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

  // Credit usage breakdown
  const creditBreakdown = useMemo(() => {
    if (!creditsUsage) return [];
    const map: Record<string, number> = {};
    creditsUsage.forEach((u) => { map[u.action_type] = (map[u.action_type] || 0) + u.amount; });
    return Object.entries(map).map(([name, value], i) => ({
      name: name.replace(/_/g, " "), value, fill: COLORS[i % COLORS.length],
    }));
  }, [creditsUsage]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground mt-1">Deep insights into your influencer marketing performance</p>
      </div>

      {/* Two wide stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="glass-card-hover">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Creators</p>
              <p className="text-3xl font-bold data-mono">{totalCreators.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card-hover">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Reach</p>
              <p className="text-3xl font-bold data-mono">48.2M</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown + Engagement Over Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Platform Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {platformData.length > 0 ? (
              <ChartContainer config={{ count: { label: "Creators", color: "hsl(var(--primary))" } }} className="h-[260px] w-full">
                <BarChart data={platformData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {platformData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No platform data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Engagement Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ rate: { label: "Engagement %", color: "hsl(var(--primary))" } }} className="h-[260px] w-full">
              <LineChart data={engagementData} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Niches + Campaign Conversion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Performing Niches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topNiches.map((n, i) => (
                <div key={n.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}</span>
                    <span className="text-sm font-medium">{n.name}</span>
                  </div>
                  <span className="text-sm font-semibold data-mono text-primary">{n.roi}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {campaignPerformance.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Campaign Conversion Rates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ rate: { label: "Conversion %", color: "hsl(var(--primary))" } }} className="h-[260px] w-full">
                <BarChart data={campaignPerformance} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Credit Usage */}
      {creditBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" /> Credit Usage Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ChartContainer config={{ value: { label: "Credits", color: "hsl(var(--primary))" } }} className="h-[260px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={creditBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} strokeWidth={2} stroke="hsl(var(--background))">
                  {creditBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {(!campaigns || campaigns.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">No Data Yet</h3>
            <p className="text-sm text-muted-foreground">Create campaigns and start tracking influencers to see analytics here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
