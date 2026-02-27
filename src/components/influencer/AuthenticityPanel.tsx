import { ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface AuthenticityData {
  score: number;
  risk_level: string;
  flags: string[];
  summary: string;
}

interface AuthenticityPanelProps {
  authenticity: AuthenticityData;
  className?: string;
}

const riskColors: Record<string, string> = {
  low: "text-green-500 bg-green-500/10 border-green-500/20",
  medium: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
  high: "text-red-500 bg-red-500/10 border-red-500/20",
};

export function AuthenticityPanel({ authenticity, className }: AuthenticityPanelProps) {
  const progressColor = authenticity.score >= 70 ? "bg-green-500" : authenticity.score >= 40 ? "bg-yellow-500" : "bg-red-500";

  return (
    <Card className={className || "glass-card"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Audience Authenticity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold data-mono">{authenticity.score}</div>
          <div className="flex-1">
            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
              <div className={`absolute inset-y-0 left-0 rounded-full ${progressColor}`} style={{ width: `${authenticity.score}%` }} />
            </div>
          </div>
          <Badge variant="outline" className={riskColors[authenticity.risk_level] || ""}>
            {authenticity.risk_level} risk
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{authenticity.summary}</p>
        {authenticity.flags.length > 0 && (
          <div className="space-y-1">
            {authenticity.flags.map((flag, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-yellow-500">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {flag}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
