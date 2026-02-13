import { useState } from "react";
import { Sparkles, RefreshCw, Loader2, Lightbulb, Target, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAIInsights, type Recommendation } from "@/hooks/useAIInsights";

const categoryIcons: Record<string, any> = {
  outreach: Target,
  budget: DollarSign,
  timeline: Clock,
  strategy: Lightbulb,
};

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-500 border-red-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-green-500/10 text-green-500 border-green-500/20",
};

interface AIInsightsPanelProps {
  campaignContext: {
    name: string;
    status: string;
    budget: number | null;
    start_date: string | null;
    end_date: string | null;
    stages: { name: string; card_count: number }[];
    total_cards: number;
    outreach_count: number;
  };
}

export function AIInsightsPanel({ campaignContext }: AIInsightsPanelProps) {
  const { getCampaignRecommendations, recommendLoading } = useAIInsights();
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleGenerate = async () => {
    const result = await getCampaignRecommendations(campaignContext);
    if (result) setRecommendations(result);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between gap-2 h-10">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">AI Insights</span>
          </span>
          <span className="text-xs text-muted-foreground">{isOpen ? "Collapse" : "Expand"}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">AI-powered campaign recommendations</p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleGenerate}
              disabled={recommendLoading}
            >
              {recommendLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {recommendations ? "Refresh" : "Generate"}
            </Button>
          </div>

          {recommendLoading && !recommendations && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing campaign…
            </div>
          )}

          {recommendations && recommendations.length > 0 && (
            <div className="space-y-2">
              {recommendations.map((rec, i) => {
                const CatIcon = categoryIcons[rec.category] || Lightbulb;
                return (
                  <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CatIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium flex-1">{rec.title}</span>
                      <Badge variant="outline" className={`text-[9px] ${priorityColors[rec.priority] || ""}`}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground pl-5.5">{rec.description}</p>
                  </div>
                );
              })}
            </div>
          )}

          {recommendations && recommendations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">No recommendations at this time.</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
