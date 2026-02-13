import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, ResponsiveContainer } from "recharts";
import { BarChart3, ChevronDown, ChevronUp, PieChart as PieIcon, TrendingUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface PipelineCard {
  id: string;
  stage_id: string;
  agreed_rate: number | null;
  created_at: string;
}

interface Campaign {
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
}

interface CampaignAnalyticsProps {
  stages: Stage[];
  cards: PipelineCard[];
  campaign: Campaign;
}

const CHART_COLORS = [
  "hsl(263, 70%, 50%)",
  "hsl(174, 83%, 52%)",
  "hsl(45, 93%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(340, 82%, 52%)",
  "hsl(200, 98%, 48%)",
];

export function CampaignAnalytics({ stages, cards, campaign }: CampaignAnalyticsProps) {
  const [open, setOpen] = useState(false);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  // Funnel data: count per stage in pipeline order
  const funnelData = useMemo(() => {
    return sortedStages.map((stage, i) => ({
      name: stage.name,
      count: cards.filter((c) => c.stage_id === stage.id).length,
      fill: stage.color || CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [sortedStages, cards]);

  // Conversion rates between consecutive stages
  const conversionData = useMemo(() => {
    if (sortedStages.length < 2) return [];
    return sortedStages.slice(1).map((stage, i) => {
      const prevCount = cards.filter((c) => c.stage_id === sortedStages[i].id).length;
      const curCount = cards.filter((c) => c.stage_id === stage.id).length;
      const rate = prevCount > 0 ? Math.round((curCount / prevCount) * 100) : 0;
      return {
        name: `${sortedStages[i].name} → ${stage.name}`,
        short: `→ ${stage.name}`,
        rate,
      };
    });
  }, [sortedStages, cards]);

  // Pie data for stage distribution
  const pieData = useMemo(() => {
    return sortedStages
      .map((stage, i) => ({
        name: stage.name,
        value: cards.filter((c) => c.stage_id === stage.id).length,
        fill: stage.color || CHART_COLORS[i % CHART_COLORS.length],
      }))
      .filter((d) => d.value > 0);
  }, [sortedStages, cards]);

  // Budget burn: cumulative agreed rate over time
  const budgetBurnData = useMemo(() => {
    if (!campaign.budget) return [];
    const sorted = [...cards]
      .filter((c) => c.agreed_rate && c.agreed_rate > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (sorted.length === 0) return [];

    let cumulative = 0;
    return sorted.map((card) => {
      cumulative += card.agreed_rate || 0;
      return {
        date: new Date(card.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        spent: cumulative,
        budget: campaign.budget,
      };
    });
  }, [cards, campaign.budget]);

  const funnelConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    sortedStages.forEach((stage, i) => {
      config[stage.name] = {
        label: stage.name,
        color: stage.color || CHART_COLORS[i % CHART_COLORS.length],
      };
    });
    config.count = { label: "Influencers", color: "hsl(var(--primary))" };
    return config;
  }, [sortedStages]);

  if (cards.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full flex items-center justify-between px-4 py-2 h-auto">
          <span className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            Campaign Analytics
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
          {/* Pipeline Funnel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Pipeline Funnel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={funnelConfig} className="h-[220px] w-full">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Stage Distribution Pie */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-primary" />
                Stage Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {pieData.length > 0 ? (
                <ChartContainer config={funnelConfig} className="h-[220px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data</p>
              )}
            </CardContent>
          </Card>

          {/* Conversion Rates */}
          {conversionData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Stage Conversion Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{ rate: { label: "Conversion %", color: "hsl(var(--primary))" } }} className="h-[220px] w-full">
                  <BarChart data={conversionData} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <XAxis dataKey="short" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Budget Burn */}
          {budgetBurnData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Budget Burn Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{ spent: { label: "Spent", color: "hsl(var(--primary))" }, budget: { label: "Budget", color: "hsl(var(--muted-foreground))" } }} className="h-[220px] w-full">
                  <AreaChart data={budgetBurnData} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toLocaleString()}`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="budget" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="spent" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
