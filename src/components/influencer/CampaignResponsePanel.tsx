/**
 * CampaignResponsePanel
 *
 * Uses computeCampaignForecast() to display outreach success probability signals.
 * Panel is hidden when result.uncertain === true (confidence < 0.60).
 */

import { Send, Target, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeCampaignForecast, type CampaignForecastInput } from "@/modules/campaign/prediction/campaign_forecast";

interface CampaignResponsePanelProps {
  platform: CampaignForecastInput["platform"];
  followerCount: number | null;
  engagementRate: number | null;
  botProbability: number | null;
  creatorNiche: string | null;
  brandVertical?: string | null;
  hasContactEmail?: boolean;
  className?: string;
}

function ProbBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-muted/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold data-mono text-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

export function CampaignResponsePanel({
  platform,
  followerCount,
  engagementRate,
  botProbability,
  creatorNiche,
  brandVertical = null,
  hasContactEmail = false,
  className = "",
}: CampaignResponsePanelProps) {
  const result = computeCampaignForecast({
    platform,
    followerCount,
    engagementRate,
    botProbability,
    creatorNiche,
    brandVertical,
    hasContactEmail,
  });

  // Confidence gate — spec: hide when uncertain
  if (result.uncertain) return null;

  const successPct = Math.round(result.outreachSuccessScore * 100);
  const successColor =
    successPct >= 65 ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : successPct >= 40 ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-red-600 bg-red-50 border-red-200";

  return (
    <Card className={`${className}`} data-testid="campaign-response-panel">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Campaign Response Probability
        </CardTitle>
        <Badge variant="outline" className={`text-[10px] font-semibold border ${successColor}`}>
          {successPct}% success
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Send className="h-3 w-3" /> Outreach Response
              </span>
            </div>
            <ProbBar value={result.responseProbability} color="bg-blue-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <BarChart2 className="h-3 w-3" /> Conversion Likelihood
              </span>
            </div>
            <ProbBar value={result.conversionLikelihood} color="bg-indigo-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Target className="h-3 w-3" /> Overall Success Score
              </span>
            </div>
            <ProbBar value={result.outreachSuccessScore} color="bg-primary" />
          </div>
        </div>

        {result.signals.length > 0 && (
          <details className="group">
            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1 select-none">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              {result.signals.length} signal{result.signals.length !== 1 ? "s" : ""} used
            </summary>
            <ul className="mt-2 space-y-1 pl-3 border-l-2 border-muted">
              {result.signals.map((s, i) => (
                <li key={i} className="text-[10px] text-muted-foreground leading-relaxed">{s}</li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-[9px] text-muted-foreground/60 border-t border-border/20 pt-2">
          Confidence {Math.round(result.confidence * 100)}% · {result.dataOrigin} · Probabilistic model — actual outcomes may vary
        </p>
      </CardContent>
    </Card>
  );
}
