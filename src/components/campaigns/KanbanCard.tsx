import { Instagram, Youtube, SlidersHorizontal, Search, ExternalLink, GripVertical, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

const platformColors: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  tiktok: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  youtube: "bg-red-500/10 text-red-500 border-red-500/20",
};

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  tiktok: SlidersHorizontal,
  youtube: Youtube,
};

interface KanbanCardProps {
  card: {
    id: string;
    username: string;
    platform: string;
    data: any;
    notes: string | null;
    agreed_rate: number | null;
  };
  onEdit: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  contacted?: boolean;
  onSendEmail?: () => void;
}

const riskDotColors: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-red-500",
};

export function KanbanCard({ card, onEdit, draggable, onDragStart, selectable, selected, onSelect, contacted, onSendEmail }: KanbanCardProps) {
  const PlatformIcon = platformIcons[card.platform] || Search;
  const d = card.data as any;

  const fraudRisk = (d?.ai_fraud_check as any)?.risk as string | undefined;

  return (
    <Card
      className={`glass-card cursor-pointer hover:border-primary/30 transition-colors group ${selected ? "border-primary/50 bg-primary/5" : ""}`}
      draggable={draggable && !selectable}
      onDragStart={onDragStart}
      onClick={() => {
        if (selectable && onSelect) {
          onSelect(card.id);
        } else {
          onEdit();
        }
      }}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          {selectable && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onSelect?.(card.id)}
              className="mt-0.5"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {draggable && !selectable && <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0 cursor-grab" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{d?.title || card.username}</p>
              <Badge variant="outline" className={`text-[9px] shrink-0 ${platformColors[card.platform] || ""}`}>
                {card.platform}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground truncate">{card.username}</p>
              {fraudRisk && <span className={`h-2 w-2 rounded-full shrink-0 ${riskDotColors[fraudRisk] || ""}`} title={`Fraud risk: ${fraudRisk}`} />}
              {contacted && (
                <Badge variant="outline" className="text-[9px] gap-0.5 bg-green-500/10 text-green-500 border-green-500/20">
                  <Mail className="h-2.5 w-2.5" />
                  Contacted
                </Badge>
              )}
            </div>
            {card.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{card.notes}</p>}
            <div className="flex items-center justify-between mt-2">
              {card.agreed_rate != null && (
                <span className="text-xs font-medium text-primary">${Number(card.agreed_rate).toLocaleString()}</span>
              )}
              <div className="flex items-center gap-0.5 ml-auto">
                {onSendEmail && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onSendEmail(); }}>
                    <Mail className="h-3 w-3" />
                  </Button>
                )}
                {d?.link && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 p-1" asChild onClick={(e) => e.stopPropagation()}>
                    <a href={d.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
