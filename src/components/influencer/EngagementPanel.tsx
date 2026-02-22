import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EngagementRating {
  rate: number;
  benchmark_comparison: string;
  verdict: string;
}

interface EngagementPanelProps {
  engagement: EngagementRating;
  platform: string;
}

const benchmarks: Record<string, { low: number; high: number }> = {
  instagram: { low: 1, high: 3 },
  tiktok: { low: 3, high: 6 },
  youtube: { low: 2, high: 5 },
};

export function EngagementPanel({ engagement, platform }: EngagementPanelProps) {
  const bench = benchmarks[platform] || { low: 1, high: 3 };
  const rate = engagement.rate;

  let color = "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
  let Icon = Minus;
  if (rate >= bench.high) { color = "text-green-500 bg-green-500/10 border-green-500/20"; Icon = TrendingUp; }
  else if (rate < bench.low) { color = "text-red-500 bg-red-500/10 border-red-500/20"; Icon = TrendingDown; }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Engagement Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold data-mono">{rate.toFixed(2)}%</div>
          <Badge variant="outline" className={`gap-1 ${color}`}>
            <Icon className="h-3 w-3" />
            {engagement.benchmark_comparison}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{engagement.verdict}</p>
        <div className="flex gap-2 text-[10px] text-muted-foreground">
          <span>Industry range: {bench.low}–{bench.high}% ({platform})</span>
        </div>
      </CardContent>
    </Card>
  );
}
