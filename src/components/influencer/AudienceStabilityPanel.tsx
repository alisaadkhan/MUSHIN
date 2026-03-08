/**
 * AudienceStabilityPanel
 *
 * Derives an Audience Stability Index from available profile signals:
 *   - Engagement rate quality (vs platform baselines)
 *   - Bot probability (inverted — lower bot risk = more stable)
 *   - Posting consistency (derived from postsCount + accountAgeDays)
 *
 * Hidden when there is insufficient data to produce a meaningful score
 * (requires at least engagementRate or botProbability).
 *
 * Confidence gate: score < 0.40 uncertainty → shows "Insufficient data" pill instead.
 */

import { Users, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AudienceStabilityPanelProps {
  platform: string;
  followerCount: number | null;
  engagementRate: number | null;   // 0–100 scale, e.g. 3.5 = 3.5%
  botProbability: number | null;   // 0–100 scale, e.g. 15 = 15%
  postsCount: number | null;
  accountAgeDays?: number | null;
  className?: string;
}

const platformERBaselines: Record<string, { ok: number; good: number }> = {
  instagram: { ok: 1.5,  good: 3.0  },
  tiktok:    { ok: 4.0,  good: 8.0  },
  youtube:   { ok: 2.0,  good: 4.0  },
  twitter:   { ok: 0.5,  good: 1.5  },
  twitch:    { ok: 2.0,  good: 5.0  },
  facebook:  { ok: 1.0,  good: 2.5  },
};

function deriveStabilityScore(
  platform: string,
  er: number | null,
  botProb: number | null,
  postsCount: number | null,
  accountAgeDays: number | null,
): { score: number; signals: number } {
  const baseline = platformERBaselines[platform] ?? { ok: 1.5, good: 3.0 };
  let score = 0;
  let signals = 0;

  // Signal 1: Engagement rate quality (weight 0.45)
  if (er !== null) {
    const erScore = er >= baseline.good ? 1 : er >= baseline.ok ? er / baseline.good : er / (baseline.ok * 2);
    score += Math.min(1, Math.max(0, erScore)) * 0.45;
    signals++;
  }

  // Signal 2: Bot risk (inverted, weight 0.40)
  if (botProb !== null) {
    const botScore = 1 - botProb / 100;
    score += Math.min(1, Math.max(0, botScore)) * 0.40;
    signals++;
  }

  // Signal 3: Posting consistency (weight 0.15, requires both fields)
  if (postsCount !== null && accountAgeDays !== null && accountAgeDays > 0) {
    const ppm = (postsCount / accountAgeDays) * 30; // posts per month
    const consistencyScore = ppm >= 8 ? 1 : ppm >= 4 ? 0.75 : ppm >= 1 ? 0.50 : 0.20;
    score += consistencyScore * 0.15;
    signals++;
  } else if (postsCount !== null) {
    // Partial consistency signal without age data
    const partialScore = postsCount >= 100 ? 0.70 : postsCount >= 30 ? 0.50 : 0.30;
    score += partialScore * 0.15;
    signals++;
  }

  return { score, signals };
}

export function AudienceStabilityPanel({
  platform,
  followerCount: _followerCount,
  engagementRate,
  botProbability,
  postsCount,
  accountAgeDays = null,
  className = "",
}: AudienceStabilityPanelProps) {
  // Need at least one meaningful signal
  if (engagementRate === null && botProbability === null) return null;

  const { score, signals } = deriveStabilityScore(
    platform,
    engagementRate,
    botProbability,
    postsCount,
    accountAgeDays,
  );

  const pct = Math.round(score * 100);

  // Confidence gate: fewer than 2 signals → show insufficient data callout
  const isUncertain = signals < 2;

  const tier =
    pct >= 72 ? { label: "High Stability",   color: "text-emerald-600 bg-emerald-50 border-emerald-200", barColor: "bg-emerald-500", ShieldIcon: ShieldCheck }
    : pct >= 45 ? { label: "Moderate Stability", color: "text-amber-600 bg-amber-50 border-amber-200",   barColor: "bg-amber-500",   ShieldIcon: ShieldAlert }
    :             { label: "Low Stability",    color: "text-red-600 bg-red-50 border-red-200",            barColor: "bg-red-500",     ShieldIcon: ShieldAlert };

  return (
    <Card className={`${className}`} data-testid="audience-stability-panel">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Audience Stability Index
        </CardTitle>
        {!isUncertain && (
          <Badge variant="outline" className={`gap-1 text-[10px] font-semibold border ${tier.color}`}>
            <tier.ShieldIcon className="h-3 w-3" />
            {tier.label}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isUncertain ? (
          <p className="text-xs text-muted-foreground italic">
            Insufficient data to compute audience stability — enrich the profile for a complete signal set.
          </p>
        ) : (
          <>
            <div>
              <div className="flex items-end justify-between mb-1.5">
                <span className="text-3xl font-black data-mono text-foreground">{pct}</span>
                <span className="text-xs text-muted-foreground mb-1">/100 stability</span>
              </div>
              <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${tier.barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
              {engagementRate !== null && (
                <div className="bg-muted/30 rounded-lg px-2.5 py-2">
                  <p className="font-medium text-foreground">{engagementRate.toFixed(1)}%</p>
                  <p>Engagement Rate</p>
                </div>
              )}
              {botProbability !== null && (
                <div className="bg-muted/30 rounded-lg px-2.5 py-2">
                  <p className="font-medium text-foreground">{botProbability.toFixed(0)}%</p>
                  <p>Bot Risk</p>
                </div>
              )}
            </div>

            <p className="text-[9px] text-muted-foreground/60 border-t border-border/20 pt-2">
              Derived from {signals} profile signal{signals !== 1 ? "s" : ""} · Composite index
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
