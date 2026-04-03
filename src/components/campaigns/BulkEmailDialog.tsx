import { useState } from "react";
import { Loader2, Send, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Progress } from "@/components/ui/progress";
import { useEmailTemplates, substituteVariables } from "@/hooks/useEmailTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface CardForEmail {
  id: string;
  username: string;
  platform: string;
  data: any;
}

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cards: CardForEmail[];
  campaignId: string;
  campaignName?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
}

export function BulkEmailDialog({
  open,
  onOpenChange,
  cards,
  campaignId,
  campaignName,
  defaultFromName,
  defaultReplyTo,
}: BulkEmailDialogProps) {
  const { templates } = useEmailTemplates();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });

  const updateEmail = (cardId: string, email: string) => {
    setEmails((prev) => ({ ...prev, [cardId]: email }));
  };

  const cardsWithEmail = cards.filter((c) => emails[c.id]?.trim());

  const handleSend = async () => {
    if (!selectedTemplateId || cardsWithEmail.length === 0) {
      toast({ title: "Select a template and enter at least one email", variant: "destructive" });
      return;
    }

    const template = templates?.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = cardsWithEmail.filter(card => !EMAIL_REGEX.test(emails[card.id]?.trim()));
    if (invalidEmails.length > 0) {
      toast({ title: "Invalid emails", description: `${invalidEmails.length} email address(es) are invalid.`, variant: "destructive" });
      return;
    }

    setSending(true);
    setProgress({ sent: 0, total: cardsWithEmail.length });
    let successCount = 0;

    for (const card of cardsWithEmail) {
      const variables: Record<string, string> = {
        username: card.username,
        platform: card.platform,
        campaign_name: campaignName || "",
      };

      try {
        const { data, error } = await supabase.functions.invoke("send-outreach-email", {
          body: {
            to: emails[card.id].trim(),
            subject: substituteVariables(template.subject, variables),
            body: substituteVariables(template.body, variables),
            from_name: defaultFromName || undefined,
            reply_to: defaultReplyTo || undefined,
            card_id: card.id,
            campaign_id: campaignId,
            username: card.username,
            platform: card.platform,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        successCount++;
      } catch (err: any) {
        console.error(`Failed to send to ${card.username}:`, err.message);
      }
      setProgress((p) => ({ ...p, sent: p.sent + 1 }));
    }

    queryClient.invalidateQueries({ queryKey: ["outreach-log", campaignId] });
    queryClient.invalidateQueries({ queryKey: ["workspace-credits"] });
    toast({ title: `Sent ${successCount}/${cardsWithEmail.length} emails` });
    setSending(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Bulk Email — {cards.length} influencers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {templates && templates.length > 0 ? (
            <div>
              <Label className="text-xs">Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose a template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No email templates. Create one in Settings → Outreach first.</p>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Email addresses</Label>
            {cards.map((card) => (
              <div key={card.id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-28 truncate">{card.username}</span>
                <Input
                  placeholder="email@example.com"
                  value={emails[card.id] || ""}
                  onChange={(e) => updateEmail(card.id, e.target.value)}
                  className="h-8 text-xs flex-1"
                  disabled={sending}
                />
              </div>
            ))}
          </div>

          {sending && (
            <div className="space-y-1">
              <Progress value={(progress.sent / progress.total) * 100} />
              <p className="text-xs text-muted-foreground text-center">
                Sending {progress.sent}/{progress.total}…
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !selectedTemplateId || cardsWithEmail.length === 0} className="gap-1.5">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send {cardsWithEmail.length > 0 ? `(${cardsWithEmail.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
