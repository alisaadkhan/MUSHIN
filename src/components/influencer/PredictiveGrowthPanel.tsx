/**
 * PredictiveGrowthPanel
 *
 * Uses computeTrendVelocityScore() to display a creator's trend velocity.
 * Panel is hidden when result.uncertain === true (confidence < 0.65).
 */

import { TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeTrendVelocityScore, type DiscoveryForecastInput } from "@/modules/predictive-intelligence/discovery_forecast";

interface PredictiveGrowthPanelProps {
  platform: DiscoveryForecastInput["platform"];
  followerCount: number | null;
  recentFollowerDelta: number | null;
  engagementRate: number | null;
  engagementRatePrev?: number | null;
  postsCount: number | null;
  accountAgeDays?: number | null;
  primaryNiche: string | null;
  avgViews?: number | null;
  className?: string;
}

const labelConfig = {
  surging: { color: "text-emerald-600 bg-emerald-50 border-emerald-200", barColor: "bg-emerald-500", Icon: TrendingUp },
  rising:  { color: "text-blue-600 bg-blue-50 border-blue-200",          barColor: "bg-blue-500",    Icon: TrendingUp },
  stable:  { color: "text-amber-600 bg-amber-50 border-amber-200",        barColor: "bg-amber-500",   Icon: Minus },
  declining: { color: "text-red-600 bg-red-50 border-red-200",            barColor: "bg-red-500",     Icon: TrendingDown },
};

const breakdownLabels: Record<string, string> = {
  growthRateProjection:       "Growth Rate Projection",
  engagementStability:        "Engagement Stability",
  postingConsistency:         "Posting Consistency",
  audienceRetentionEstimate:  "Audience Retention",
  nicheTrendPopularity:       "Niche Trend Popularity",
};

export function PredictiveGrowthPanel({
  platform,
  followerCount,
  recentFollowerDelta,
  engagementRate,
  engagementRatePrev = null,
  postsCount,
  accountAgeDays = null,
  primaryNiche,
  avgViews = null,
  className = "",
}: PredictiveGrowthPanelProps) {
  const result = computeTrendVelocityScore({
    platform,
    followerCount,
    recentFollowerDelta,
    engagementRate,
    engagementRatePrev,
    postsCount,
    accountAgeDays,
    primaryNiche,
    avgViews,
  });

  // Confidence gate — spec: hide when uncertain
  if (result.uncertain) return null;

  const cfg = labelConfig[result.trendLabel];
  const scorePct = Math.round(result.trendVelocityScore * 100);

  return (
    <Card className={`${className}`} data-testid="predictive-growth-panel">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Predictive Growth Forecast
        </CardTitle>
        <Badge variant="outline" className={`gap-1 text-[10px] font-semibold border ${cfg.color}`}>
          <cfg.Icon className="h-3 w-3" />
          {result.trendLabel.charAt(0).toUpperCase() + result.trendLabel.slice(1)}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Trend velocity gauge */}
        <div>
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-3xl font-black data-mono text-foreground">{scorePct}</span>
            <span className="text-xs text-muted-foreground mb-1">/100 trend score</span>
          </div>
          <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${cfg.barColor}`}
              style={{ width: `${scorePct}%` }}
            />
          </div>
        </div>

        {/* Signal breakdown */}
        <div className="space-y-2 pt-1">
          {(Object.entries(result.breakdown) as [string, number | null][]).map(([key, value]) => {
            if (value === null) return null;
            const pct = Math.round(value * 100);
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-36 shrink-0">{breakdownLabels[key] ?? key}</span>
                <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-medium text-foreground w-7 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>

        <p className="text-[9px] text-muted-foreground/60 border-t border-border/20 pt-2">
          Confidence {Math.round(result.confidence * 100)}% · {result.dataOrigin} · Predictive model — not a guarantee of future growth
        </p>
      </CardContent>
    </Card>
  );
}
