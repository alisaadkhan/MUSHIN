import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from "recharts";
import { BarChart3, DollarSign, Users, TrendingUp, Mail, Brain, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const COLORS = ["hsl(263,70%,50%)", "hsl(174,83%,52%)", "hsl(45,93%,58%)", "hsl(142,71%,45%)", "hsl(340,82%,52%)", "hsl(200,98%,48%)"];

export default function AnalyticsPage() {
  const { workspace } = useAuth();
  const wid = workspace?.workspace_id;

  const { data: campaigns } = useQuery({
    queryKey: ["analytics-campaigns", wid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, pipeline_cards(*), pipeline_stages(*)")
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

  const { data: outreachLogs } = useQuery({
    queryKey: ["analytics-outreach", wid],
    queryFn: async () => {
      if (!campaigns?.length) return [];
      const campaignIds = campaigns.map((c) => c.id);
      const { data, error } = await supabase
        .from("outreach_log")
        .select("*")
        .in("campaign_id", campaignIds);
      if (error) throw error;
      return data;
    },
    enabled: !!campaigns?.length,
  });

  // Summary metrics
  const totalSpend = useMemo(() => campaigns?.reduce((sum, c) => sum + (c.budget || 0), 0) || 0, [campaigns]);
  const totalInfluencers = useMemo(() => campaigns?.reduce((sum, c) => sum + (c.pipeline_cards?.length || 0), 0) || 0, [campaigns]);
  const totalEmails = outreachLogs?.length || 0;

  // Campaign performance: conversion rate per campaign
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
    creditsUsage.forEach((u) => {
      map[u.action_type] = (map[u.action_type] || 0) + u.amount;
    });
    return Object.entries(map).map(([name, value], i) => ({
      name: name.replace(/_/g, " "),
      value,
      fill: COLORS[i % COLORS.length],
    }));
  }, [creditsUsage]);

  // Monthly trends
  const monthlyTrends = useMemo(() => {
    if (!creditsUsage) return [];
    const map: Record<string, number> = {};
    creditsUsage.forEach((u) => {
      const month = new Date(u.created_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      map[month] = (map[month] || 0) + u.amount;
    });
    return Object.entries(map).map(([month, total]) => ({ month, total }));
  }, [creditsUsage]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Analytics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Budget</p>
              <p className="text-xl font-bold">${totalSpend.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Influencers</p>
              <p className="text-xl font-bold">{totalInfluencers}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Emails Sent</p>
              <p className="text-xl font-bold">{totalEmails}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Campaigns</p>
              <p className="text-xl font-bold">{campaigns?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Campaign Performance */}
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

        {/* Credit Usage Breakdown */}
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

        {/* Monthly Trends */}
        {monthlyTrends.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> Monthly Credit Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ total: { label: "Credits Used", color: "hsl(var(--primary))" } }} className="h-[220px] w-full">
                <AreaChart data={monthlyTrends} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

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
