import { AlertCircle, Tag, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export interface BrandMention {
    id: string;
    brand_name: string;
    category: string;
    mentioned_at: string;
    post_id: string;
    is_competitor?: boolean; // Hydrated on client side usually
}

interface BrandAffinityPanelProps {
    mentions: BrandMention[];
    competitors?: string[]; // E.g. ["Nike", "Adidas"]
    className?: string;
}

export function BrandAffinityPanel({ mentions, competitors = [], className = "" }: BrandAffinityPanelProps) {
    if (!mentions || mentions.length === 0) return null;

    // Hydrate with competitor flagging
    const hydratedMentions = mentions.map(m => ({
        ...m,
        is_competitor: competitors.some(c => m.brand_name.toLowerCase().includes(c.toLowerCase()))
    }));

    const competitorMentions = hydratedMentions.filter(m => m.is_competitor);

    return (
        <Card className={`glass-card ${className}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    Brand Affinity & Mentions
                </CardTitle>
                {competitorMentions.length > 0 && (
                    <Badge variant="outline" className="text-[10px] font-medium bg-red-500/10 text-red-600 border-red-500/20 gap-1 flex items-center">
                        <AlertCircle className="h-3 w-3" />
                        {competitorMentions.length} Competitor Flags
                    </Badge>
                )}
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="relative border-l border-border/50 ml-2 pl-4 space-y-4 pt-2">
                        {hydratedMentions.slice(0, 5).map((mention) => (
                            <div key={mention.id} className="relative">
                                {/* Timeline Dot */}
                                <div className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background ring-1 ${mention.is_competitor ? 'bg-red-500 ring-red-500/50' : 'bg-primary ring-primary/30'}`} />

                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                            {mention.brand_name}
                                            {mention.is_competitor && <AlertCircle className="h-3 w-3 text-red-500" strokeWidth={2.5} />}
                                            {!mention.is_competitor && <CheckCircle2 className="h-3 w-3 text-emerald-500" strokeWidth={2.5} />}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {formatDistanceToNow(new Date(mention.mentioned_at), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground bg-muted/50 w-fit px-1.5 rounded-sm">
                                        {mention.category}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {hydratedMentions.length > 5 && (
                        <p className="text-xs text-center text-muted-foreground pt-2 cursor-pointer hover:text-primary transition-colors">
                            +{hydratedMentions.length - 5} more mentions
                        </p>
                    )}

                    {/* Cloud Summary */}
                    <div className="pt-2 border-t border-border/50">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Most Mentioned</p>
                        <div className="flex flex-wrap gap-1.5">
                            {Array.from(new Set(hydratedMentions.map(m => m.brand_name))).slice(0, 6).map(brand => {
                                const isComp = competitors.some(c => brand.toLowerCase().includes(c.toLowerCase()));
                                return (
                                    <Badge key={brand} variant="secondary" className={`text-[10px] ${isComp ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' : ''}`}>
                                        {brand}
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
