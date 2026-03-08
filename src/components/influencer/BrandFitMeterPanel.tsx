/**
 * BrandFitMeterPanel
 *
 * Uses computeBrandAffinity() to display how well this creator's profile
 * fits a brand partnership opportunity in their primary niche.
 *
 * When no specific brandVertical is provided, defaults to the creator's own
 * niche — measuring general brand partnership fit within their content category.
 *
 * Panel is hidden when result.uncertain === true (confidence < 0.60).
 */

import { Handshake, Star, Minus, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeBrandAffinity, type BrandAffinityInput } from "@/modules/trend-intelligence/brand_affinity_scoring";

interface BrandFitMeterPanelProps {
  platform: BrandAffinityInput["platform"];
  followerCount: number | null;
  engagementRate: number | null;   // 0–100 scale
  botProbability: number | null;   // 0–100 scale
  creatorNiche: string | null;
  /** Specific brand vertical to score against; defaults to creatorNiche */
  brandVertical?: string | null;
  pastSponsorshipCount?: number;
  className?: string;
}

const recommendationConfig = {
  strong_match:    { label: "Strong Match",    color: "text-emerald-600 bg-emerald-50 border-emerald-200", barColor: "bg-emerald-500", Icon: Star },
  potential_match: { label: "Potential Match", color: "text-blue-600 bg-blue-50 border-blue-200",          barColor: "bg-blue-500",    Icon: Minus },
  weak_match:      { label: "Weak Match",      color: "text-amber-600 bg-amber-50 border-amber-200",       barColor: "bg-amber-500",   Icon: AlertTriangle },
};

const signalLabels: Record<string, string> = {
  nicheCompatibility:  "Niche Compatibility",
  audienceSizeFit:     "Audience Size Fit",
  engagementQuality:   "Engagement Quality",
  sponsorshipHistory:  "Sponsorship History",
};

export function BrandFitMeterPanel({
  platform,
  followerCount,
  engagementRate,
  botProbability,
  creatorNiche,
  brandVertical = null,
  pastSponsorshipCount = 0,
  className = "",
}: BrandFitMeterPanelProps) {
  // Normalize botProbability from 0–100 scale to 0–1 for the module
  const botProbNorm = botProbability !== null ? botProbability / 100 : null;

  const input: BrandAffinityInput = {
    platform,
    followerCount,
    engagementRate,
    creatorNiche,
    brandVertical: brandVertical ?? creatorNiche,
    botProbability: botProbNorm,
    pastSponsorshipCount,
  };

  const result = computeBrandAffinity(input);

  // Confidence gate — hide when uncertain
  if (result.uncertain) return null;

  const cfg = recommendationConfig[result.recommendation];
  const scorePct = Math.round(result.affinityScore * 100);

  return (
    <Card className={`${className}`} data-testid="brand-fit-meter-panel">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Handshake className="h-4 w-4 text-primary" />
          Brand Fit Probability
        </CardTitle>
        <Badge variant="outline" className={`gap-1 text-[10px] font-semibold border ${cfg.color}`}>
          <cfg.Icon className="h-3 w-3" />
          {cfg.label}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-3xl font-black data-mono text-foreground">{scorePct}</span>
            <span className="text-xs text-muted-foreground mb-1">/100 affinity</span>
          </div>
          <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${cfg.barColor}`}
              style={{ width: `${scorePct}%` }}
            />
          </div>
          {brandVertical && brandVertical !== creatorNiche && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Scored against <span className="font-medium capitalize">{brandVertical}</span> brands
            </p>
          )}
        </div>

        {/* Signal breakdown */}
        <div className="space-y-2">
          {(Object.entries(result.breakdown) as [string, number | null][]).map(([key, value]) => {
            if (value === null) return null;
            const pct = Math.round(value * 100);
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-32 shrink-0">{signalLabels[key] ?? key}</span>
                <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-medium text-foreground w-7 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>

        <p className="text-[9px] text-muted-foreground/60 border-t border-border/20 pt-2">
          Confidence {Math.round(result.confidence * 100)}% · {result.dataOrigin} · Niche-level fit estimate
        </p>
      </CardContent>
    </Card>
  );
}
