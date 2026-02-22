import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EvaluationScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

function getScoreConfig(score: number) {
  if (score >= 80) return { color: "text-green-500", bg: "bg-green-500/15 border-green-500/30", ring: "ring-green-500/30", label: "Excellent" };
  if (score >= 60) return { color: "text-blue-500", bg: "bg-blue-500/15 border-blue-500/30", ring: "ring-blue-500/30", label: "Good" };
  if (score >= 40) return { color: "text-yellow-500", bg: "bg-yellow-500/15 border-yellow-500/30", ring: "ring-yellow-500/30", label: "Average" };
  return { color: "text-red-500", bg: "bg-red-500/15 border-red-500/30", ring: "ring-red-500/30", label: "Poor" };
}

const sizeMap = {
  sm: { container: "h-7 w-7 text-[10px]", label: "text-[9px]" },
  md: { container: "h-10 w-10 text-sm", label: "text-[10px]" },
  lg: { container: "h-14 w-14 text-lg font-bold", label: "text-xs" },
};

export function EvaluationScoreBadge({ score, size = "md", showLabel = false, className }: EvaluationScoreBadgeProps) {
  const config = getScoreConfig(score);
  const sizes = sizeMap[size];

  const badge = (
    <div className={cn("flex flex-col items-center gap-0.5", className)}>
      <div className={cn(
        "rounded-full border flex items-center justify-center font-semibold data-mono",
        config.bg, config.color, sizes.container
      )}>
        {score}
      </div>
      {showLabel && <span className={cn("font-medium", config.color, sizes.label)}>{config.label}</span>}
    </div>
  );

  if (showLabel) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent><p>Score: {score}/100 — {config.label}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
