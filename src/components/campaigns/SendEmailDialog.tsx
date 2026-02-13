import { useState, useEffect } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useEmailTemplates, substituteVariables } from "@/hooks/useEmailTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: {
    id: string;
    username: string;
    platform: string;
    data: any;
  };
  campaignId: string;
  campaignName?: string;
  defaultFromName?: string;
  defaultReplyTo?: string;
}

export function SendEmailDialog({
  open,
  onOpenChange,
  card,
  campaignId,
  campaignName,
  defaultFromName,
  defaultReplyTo,
}: SendEmailDialogProps) {
  const { templates } = useEmailTemplates();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromName, setFromName] = useState(defaultFromName || "");
  const [replyTo, setReplyTo] = useState(defaultReplyTo || "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTo("");
      setSubject("");
      setBody("");
      setFromName(defaultFromName || "");
      setReplyTo(defaultReplyTo || "");
    }
  }, [open, defaultFromName, defaultReplyTo]);

  const variables: Record<string, string> = {
    username: card.username,
    platform: card.platform,
    campaign_name: campaignName || "",
  };

  const applyTemplate = (templateId: string) => {
    const t = templates?.find((tpl) => tpl.id === templateId);
    if (!t) return;
    setSubject(substituteVariables(t.subject, variables));
    setBody(substituteVariables(t.body, variables));
  };

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast({ title: "Missing fields", description: "Fill in recipient, subject, and body.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-outreach-email", {
        body: {
          to,
          subject,
          body,
          from_name: fromName || undefined,
          reply_to: replyTo || undefined,
          card_id: card.id,
          campaign_id: campaignId,
          username: card.username,
          platform: card.platform,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Email sent!" });
      queryClient.invalidateQueries({ queryKey: ["outreach-log", campaignId] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Send Email to {card.username}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {templates && templates.length > 0 && (
            <div>
              <Label className="text-xs">Template</Label>
              <Select onValueChange={applyTemplate}>
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
          )}
          <div>
            <Label className="text-xs">To (email)</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="influencer@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From name</Label>
              <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your Name" />
            </div>
            <div>
              <Label className="text-xs">Reply-to</Label>
              <Input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="you@company.com" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Collaboration opportunity" />
          </div>
          <div>
            <Label className="text-xs">Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Write your message…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="gap-1.5">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
