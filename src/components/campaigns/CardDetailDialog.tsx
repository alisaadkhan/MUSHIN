import { useState, useEffect } from "react";
import { Instagram, Youtube, SlidersHorizontal, Search, ExternalLink, Trash2, Users, Eye, TrendingUp, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  tiktok: SlidersHorizontal,
  youtube: Youtube,
};

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface CardDetailDialogProps {
  card: {
    id: string;
    username: string;
    platform: string;
    data: any;
    notes: string | null;
    agreed_rate: number | null;
    stage_id?: string;
    created_at?: string;
    updated_at?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, values: { notes?: string; agreed_rate?: number }) => void;
  onRemove: (id: string) => void;
  stages?: Stage[];
  onMove?: (cardId: string, stageId: string) => void;
}

export function CardDetailDialog({ card, open, onOpenChange, onSave, onRemove, stages, onMove }: CardDetailDialogProps) {
  const [notes, setNotes] = useState("");
  const [rate, setRate] = useState("");

  useEffect(() => {
    if (card) {
      setNotes(card.notes || "");
      setRate(card.agreed_rate != null ? String(card.agreed_rate) : "");
    }
  }, [card]);

  if (!card) return null;

  const PlatformIcon = platformIcons[card.platform] || Search;
  const d = card.data as any;

  const followers = d?.followers || d?.subscriber_count;
  const engagement = d?.engagement_rate;
  const avgViews = d?.avg_views || d?.average_views;

  const handleSave = () => {
    onSave(card.id, {
      notes: notes || undefined,
      agreed_rate: rate ? Number(rate) : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformIcon className="h-4 w-4" />
            {d?.title || card.username}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{card.username}</span>
            <Badge variant="outline" className="text-[10px]">{card.platform}</Badge>
            {d?.link && (
              <a href={d.link} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> View Profile
              </a>
            )}
          </div>

          {/* Stats row */}
          {(followers || engagement || avgViews) && (
            <div className="flex flex-wrap gap-2">
              {followers && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Users className="h-3 w-3" />
                  {Number(followers).toLocaleString()} followers
                </Badge>
              )}
              {engagement && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {Number(engagement).toFixed(2)}% engagement
                </Badge>
              )}
              {avgViews && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Eye className="h-3 w-3" />
                  {Number(avgViews).toLocaleString()} avg views
                </Badge>
              )}
            </div>
          )}

          {/* Move to stage */}
          {stages && stages.length > 0 && onMove && card.stage_id && (
            <div>
              <Label className="text-xs">Stage</Label>
              <Select
                value={card.stage_id}
                onValueChange={(stageId) => onMove(card.id, stageId)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Campaign notes…" rows={3} />
          </div>
          <div>
            <Label className="text-xs">Agreed Rate ($)</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 500" />
          </div>

          {/* Timestamps */}
          {(card.created_at || card.updated_at) && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {card.created_at && <span>Added {formatDistanceToNow(new Date(card.created_at), { addSuffix: true })}</span>}
              {card.updated_at && card.updated_at !== card.created_at && (
                <span>· Updated {formatDistanceToNow(new Date(card.updated_at), { addSuffix: true })}</span>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between">
          <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={() => { onRemove(card.id); onOpenChange(false); }}>
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
