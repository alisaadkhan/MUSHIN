import { useState, useEffect } from "react";
import { Instagram, Youtube, SlidersHorizontal, Search, ExternalLink, Trash2 } from "lucide-react";
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

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  tiktok: SlidersHorizontal,
  youtube: Youtube,
};

interface CardDetailDialogProps {
  card: {
    id: string;
    username: string;
    platform: string;
    data: any;
    notes: string | null;
    agreed_rate: number | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, values: { notes?: string; agreed_rate?: number }) => void;
  onRemove: (id: string) => void;
}

export function CardDetailDialog({ card, open, onOpenChange, onSave, onRemove }: CardDetailDialogProps) {
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
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Campaign notes…" rows={3} />
          </div>
          <div>
            <Label className="text-xs">Agreed Rate ($)</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 500" />
          </div>
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
