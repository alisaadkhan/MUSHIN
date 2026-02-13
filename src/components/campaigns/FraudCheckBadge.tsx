import { type FraudCheckResult } from "@/hooks/useAIInsights";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const riskConfig = {
  low: { icon: ShieldCheck, color: "text-green-500", bg: "bg-green-500/10 border-green-500/20", label: "Low Risk" },
  medium: { icon: ShieldAlert, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20", label: "Medium Risk" },
  high: { icon: ShieldX, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20", label: "High Risk" },
};

interface FraudCheckBadgeProps {
  result: FraudCheckResult;
  compact?: boolean;
}

export function FraudCheckBadge({ result, compact }: FraudCheckBadgeProps) {
  const config = riskConfig[result.risk];
  const Icon = config.icon;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex ${config.color}`}>
              <Icon className="h-3 w-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="font-medium text-xs">{config.label}</p>
            <p className="text-[11px] text-muted-foreground">{result.summary}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-2">
      <Badge variant="outline" className={`text-xs gap-1 ${config.bg} ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
      <p className="text-xs text-muted-foreground">{result.summary}</p>
      {result.flags.length > 0 && (
        <ul className="space-y-1">
          {result.flags.map((flag, i) => (
            <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <span className="text-yellow-500 mt-0.5">⚠</span>
              {flag}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
