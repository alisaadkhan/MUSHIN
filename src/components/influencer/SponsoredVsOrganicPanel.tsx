import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PerformanceDelta {
    sponsored_er: number; // e.g., 2.5
    organic_er: number;   // e.g., 4.2
    post_count_sponsored: number;
    post_count_organic: number;
}

interface SponsoredVsOrganicPanelProps {
    data: PerformanceDelta;
    className?: string;
}

export function SponsoredVsOrganicPanel({ data, className = "" }: SponsoredVsOrganicPanelProps) {
    if (!data) return null;

    const delta = data.organic_er > 0 ? ((data.sponsored_er - data.organic_er) / data.organic_er * 100).toFixed(1) : "0.0";
    const isNegative = data.sponsored_er < data.organic_er;

    // Max width for bars normalized to the highest ER
    const maxER = Math.max(data.sponsored_er, data.organic_er, 0.1); // Avoid division by 0
    const sponsoredWidth = `${(data.sponsored_er / maxER) * 100}%`;
    const organicWidth = `${(data.organic_er / maxER) * 100}%`;

    return (
        <Card className={`glass-card ${className}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Sponsored vs Organic
                </CardTitle>
                <Badge variant="outline" className={`text-[10px] font-medium gap-1 flex items-center ${isNegative ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}`}>
                    {isNegative ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {Math.abs(Number(delta))}% Delta
                </Badge>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 pt-2">
                    {/* Organic Bar */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-end text-xs">
                            <span className="font-medium text-foreground">Organic Posts <span className="text-muted-foreground font-normal">({data.post_count_organic})</span></span>
                            <span className="font-bold">{data.organic_er.toFixed(2)}% ER</span>
                        </div>
                        <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-slate-400 rounded-full transition-all duration-500 ease-in-out"
                                style={{ width: organicWidth }}
                            />
                        </div>
                    </div>

                    {/* Sponsored Bar */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-end text-xs">
                            <span className="font-medium text-foreground">Sponsored Posts <span className="text-muted-foreground font-normal">({data.post_count_sponsored})</span></span>
                            <span className="font-bold">{data.sponsored_er.toFixed(2)}% ER</span>
                        </div>
                        <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary/80 rounded-full transition-all duration-500 ease-in-out"
                                style={{ width: sponsoredWidth }}
                            />
                        </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground italic leading-relaxed pt-2">
                        {isNegative
                            ? `Sponsored content performs ${Math.abs(Number(delta))}% worse than organic content. Audience may be ad-fatigued or sensitive to inauthentic integrations.`
                            : `Sponsored content performs ${Math.abs(Number(delta))}% better than organic content. Excellent integration into natural content flow.`
                        }
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
