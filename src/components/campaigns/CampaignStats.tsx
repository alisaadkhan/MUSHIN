import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, DollarSign, TrendingDown, TrendingUp } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface PipelineCard {
  id: string;
  stage_id: string;
  agreed_rate: number | null;
}

interface Campaign {
  budget: number | null;
}

interface CampaignStatsProps {
  stages: Stage[];
  cards: PipelineCard[];
  campaign: Campaign;
}

export function CampaignStats({ stages, cards, campaign }: CampaignStatsProps) {
  const totalInfluencers = cards.length;
  const totalAgreed = cards.reduce((sum, c) => sum + (c.agreed_rate || 0), 0);
  const budget = campaign.budget || 0;
  const remaining = budget - totalAgreed;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total Influencers */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Influencers</p>
            <p className="text-xl font-bold">{totalInfluencers}</p>
          </div>
        </CardContent>
      </Card>

      {/* Per-Stage Breakdown */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Per Stage</p>
          {stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stages</p>
          ) : (
            <div className="space-y-1">
              {stages.map((stage) => {
                const count = cards.filter((c) => c.stage_id === stage.id).length;
                return (
                  <div key={stage.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                      <span className="truncate">{stage.name}</span>
                    </span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget & Agreed */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Budget / Agreed</p>
              <p className="text-xl font-bold">
                ${budget.toLocaleString()}
                <span className="text-sm font-normal text-muted-foreground"> / ${totalAgreed.toLocaleString()}</span>
              </p>
            </div>
          </div>
          {budget > 0 && (() => {
            const pct = Math.min((totalAgreed / budget) * 100, 100);
            const colorClass = totalAgreed > budget
              ? "[&>div]:bg-destructive"
              : pct >= 80
                ? "[&>div]:bg-amber-500"
                : "";
            return (
              <div className="space-y-1">
                <Progress value={pct} className={`h-2 ${colorClass}`} />
                <p className="text-[10px] text-muted-foreground text-right">
                  {Math.round((totalAgreed / budget) * 100)}% used
                </p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Remaining */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`h-9 w-9 rounded-md flex items-center justify-center ${remaining >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
            {remaining >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className={`text-xl font-bold ${remaining >= 0 ? "text-green-500" : "text-destructive"}`}>
              ${Math.abs(remaining).toLocaleString()}
              {remaining < 0 && <span className="text-sm font-normal"> over</span>}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
