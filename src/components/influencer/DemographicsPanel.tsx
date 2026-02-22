import { Users, Globe, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DemographicsData {
  age_range: string;
  gender_split: string;
  top_countries: string[];
}

interface DemographicsPanelProps {
  demographics: DemographicsData;
}

export function DemographicsPanel({ demographics }: DemographicsPanelProps) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Estimated Demographics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Age Range</p>
            <p className="text-sm font-medium">{demographics.age_range}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Gender Split</p>
            <p className="text-sm font-medium">{demographics.gender_split}</p>
          </div>
        </div>
        {demographics.top_countries.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <Globe className="h-3 w-3" /> Top Countries
            </p>
            <div className="flex flex-wrap gap-1.5">
              {demographics.top_countries.map((country) => (
                <Badge key={country} variant="secondary" className="text-[10px] gap-1">
                  <MapPin className="h-2.5 w-2.5" />
                  {country}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground italic">
          * Estimates based on AI analysis of content, bio, and platform signals
        </p>
      </CardContent>
    </Card>
  );
}
