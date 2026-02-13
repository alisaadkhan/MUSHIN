import { useState, useEffect } from "react";
import { Instagram, Youtube, SlidersHorizontal, Search, ExternalLink, Trash2, Users, Eye, TrendingUp, Clock, Mail, Send, Sparkles, ShieldCheck, Loader2 } from "lucide-react";
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
import { SendEmailDialog } from "./SendEmailDialog";
import { FraudCheckBadge } from "./FraudCheckBadge";
import { useAIInsights, type FraudCheckResult } from "@/hooks/useAIInsights";
import type { OutreachEntry } from "@/hooks/useOutreachLog";
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
  outreachEntries?: OutreachEntry[];
  campaignId?: string;
  campaignName?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
}

export function CardDetailDialog({ card, open, onOpenChange, onSave, onRemove, stages, onMove, outreachEntries, campaignId, campaignName, defaultFromName, defaultReplyTo }: CardDetailDialogProps) {
  const [notes, setNotes] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [rate, setRate] = useState("");
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [fraudResult, setFraudResult] = useState<FraudCheckResult | null>(null);
  const { generateSummary, summaryLoading, runFraudCheck, fraudLoading } = useAIInsights();

  useEffect(() => {
    if (card) {
      setNotes(card.notes || "");
      setRate(card.agreed_rate != null ? String(card.agreed_rate) : "");
      setAiSummary(null);
      setFraudResult((card.data as any)?.ai_fraud_check || null);
    }
  }, [card]);

  if (!card) return null;

  const PlatformIcon = platformIcons[card.platform] || Search;
  const d = card.data as any;
  const cardOutreach = outreachEntries?.filter((e) => e.card_id === card.id) || [];

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

          {/* AI Insights */}
          <div className="space-y-2 rounded-lg border border-border bg-muted/10 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">AI Insights</span>
              <div className="flex gap-1 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={async () => {
                    const s = await generateSummary({ username: card.username, platform: card.platform, followers, engagement, avgViews, ...d });
                    if (s) setAiSummary(s);
                  }}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                  Summary
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={async () => {
                    const r = await runFraudCheck({ username: card.username, platform: card.platform, followers, engagement, avgViews, ...d });
                    if (r) setFraudResult(r);
                  }}
                  disabled={fraudLoading}
                >
                  {fraudLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ShieldCheck className="h-2.5 w-2.5" />}
                  Fraud Check
                </Button>
              </div>
            </div>
            {aiSummary && <p className="text-xs text-muted-foreground">{aiSummary}</p>}
            {fraudResult && <FraudCheckBadge result={fraudResult} />}
          </div>

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

          {/* Outreach */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Outreach</Label>
              {campaignId && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setEmailOpen(true)}>
                  <Send className="h-3 w-3" /> Send Email
                </Button>
              )}
            </div>
            {cardOutreach.length > 0 && (
              <div className="space-y-1.5">
                {cardOutreach.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                    <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-500 border-green-500/20">{entry.method}</Badge>
                    <span>{new Date(entry.contacted_at).toLocaleDateString()}</span>
                    {entry.email_to && <span className="truncate text-primary">→ {entry.email_to}</span>}
                    {entry.notes && <span className="truncate">— {entry.notes}</span>}
                  </div>
                ))}
              </div>
            )}
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
      {campaignId && card && (
        <SendEmailDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          card={card}
          campaignId={campaignId}
          campaignName={campaignName}
          defaultFromName={defaultFromName}
          defaultReplyTo={defaultReplyTo}
        />
      )}
    </Dialog>
  );
}
