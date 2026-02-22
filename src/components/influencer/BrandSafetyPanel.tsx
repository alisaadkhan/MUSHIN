import { Shield, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BrandSafetyData {
  rating: "safe" | "caution" | "risk";
  flags: string[];
}

interface BrandSafetyPanelProps {
  brandSafety: BrandSafetyData;
}

const ratingConfig = {
  safe: { icon: CheckCircle, color: "text-green-500 bg-green-500/10 border-green-500/20", label: "Brand Safe" },
  caution: { icon: AlertTriangle, color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20", label: "Caution" },
  risk: { icon: AlertCircle, color: "text-red-500 bg-red-500/10 border-red-500/20", label: "High Risk" },
};

export function BrandSafetyPanel({ brandSafety }: BrandSafetyPanelProps) {
  const config = ratingConfig[brandSafety.rating] || ratingConfig.caution;
  const Icon = config.icon;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Brand Safety
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant="outline" className={`gap-1.5 text-xs ${config.color}`}>
          <Icon className="h-3.5 w-3.5" />
          {config.label}
        </Badge>
        {brandSafety.flags.length > 0 && (
          <div className="space-y-1">
            {brandSafety.flags.map((flag, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3 shrink-0 text-yellow-500" />
                {flag}
              </div>
            ))}
          </div>
        )}
        {brandSafety.flags.length === 0 && (
          <p className="text-xs text-muted-foreground">No content safety flags detected.</p>
        )}
      </CardContent>
    </Card>
  );
}
