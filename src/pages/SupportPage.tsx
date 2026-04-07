import { useState } from "react";
import { SEO } from "@/components/SEO";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy, Plus, X, MessageSquare, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Send, Loader2 } from "lucide-react";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";
type TicketCategory = "general" | "billing" | "technical" | "feature_request" | "bug";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: TicketCategory;
  created_at: string;
  updated_at: string;
}

interface TicketReply {
  id: string;
  ticket_id: string;
  author_id: string;
  is_admin: boolean;
  body: string;
  created_at: string;
}

const statusColors: Record<TicketStatus, string> = {
  open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_progress: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  closed: "bg-muted/30 text-muted-foreground border-border",
};

const priorityColors: Record<TicketPriority, string> = {
  low: "bg-muted/30 text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-400",
  high: "bg-amber-500/10 text-amber-400",
  urgent: "bg-red-500/10 text-red-400",
};

const statusIcons: Record<TicketStatus, React.ElementType> = {
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle2,
  closed: CheckCircle2,
};

export default function SupportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // New ticket form
  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<TicketPriority>("medium");
  const [newCategory, setNewCategory] = useState<TicketCategory>("general");
  const [creating, setCreating] = useState(false);

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["support-tickets", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("No user");
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return data as Ticket[];
    },
    enabled: !!user,
  });

  const { data: replies = [] } = useQuery<TicketReply[]>({
    queryKey: ["ticket-replies", expandedTicket],
    queryFn: async () => {
      if (!expandedTicket) return [];
      const { data, error } = await supabase
        .from("support_ticket_replies")
        .select("*")
        .eq("ticket_id", expandedTicket)
        .order("created_at", { ascending: true });
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return data as TicketReply[];
    },
    enabled: !!expandedTicket,
  });

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newDescription.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user!.id,
        subject: newSubject.trim(),
        description: newDescription.trim(),
        priority: newPriority,
        category: newCategory,
      });
      if (error) throw error;
      toast({ title: "Ticket submitted", description: "We'll get back to you within 24 hours." });
      setNewSubject("");
      setNewDescription("");
      setNewPriority("medium");
      setNewCategory("general");
      setShowCreateForm(false);
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !expandedTicket) return;
    setSendingReply(true);
    try {
      const { error } = await supabase.from("support_ticket_replies").insert({
        ticket_id: expandedTicket,
        author_id: user!.id,
        body: replyText.trim(),
        is_admin: false,
      });
      if (error) throw error;
      setReplyText("");
      qc.invalidateQueries({ queryKey: ["ticket-replies", expandedTicket] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSendingReply(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6 max-w-5xl">
      <SEO title="Support" description="Get help with MUSHIN." />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground flex items-center gap-3">
            <LifeBuoy className="text-primary" size={26} />
            Support Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submit a request and our team will respond within 24 hours.
          </p>
        </div>
        <Button
          className="rounded-xl font-medium btn-shine shadow-sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? <X size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />}
          {showCreateForm ? "Cancel" : "New Ticket"}
        </Button>
      </div>

      {/* Create Ticket Form */}
      {showCreateForm && (
        <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-foreground">Submit a Support Ticket</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Subject</label>
            <Input
              placeholder="Brief description of the issue"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="rounded-lg"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as TicketCategory)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="general">General</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="feature_request">Feature Request</option>
                <option value="bug">Bug Report</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea
              placeholder="Please describe your issue in detail..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={5}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="pt-2 border-t border-border/50 flex justify-end">
            <Button onClick={handleCreateTicket} disabled={creating} className="rounded-lg">
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Ticket
            </Button>
          </div>
        </div>
      )}

      {/* Tickets List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-12 text-center">
          <LifeBuoy className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-2">No tickets yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Having an issue? Submit a support ticket and we'll help you out.
          </p>
          <Button onClick={() => setShowCreateForm(true)} variant="outline" className="rounded-lg">
            <Plus size={15} className="mr-1.5" /> Create your first ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const StatusIcon = statusIcons[ticket.status];
            const isExpanded = expandedTicket === ticket.id;

            return (
              <div
                key={ticket.id}
                className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl overflow-hidden"
              >
                {/* Ticket Header */}
                <button
                  className="w-full px-6 py-4 flex items-center gap-4 hover:bg-muted/10 transition-colors text-left"
                  onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                >
                  <StatusIcon size={16} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ticket.category.replace("_", " ")} · {formatDate(ticket.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-[10px] border font-normal rounded-md px-2 ${priorityColors[ticket.priority]}`}>
                      {ticket.priority}
                    </Badge>
                    <Badge className={`text-[10px] border font-normal rounded-md px-2 ${statusColors[ticket.status]}`}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                  </div>
                </button>

                {/* Ticket Detail + Replies */}
                {isExpanded && (
                  <div className="border-t border-border/50 px-6 py-5 space-y-5">
                    <div className="bg-muted/20 rounded-xl p-4">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
                    </div>

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversation</p>
                        {replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`rounded-xl p-4 ${reply.is_admin ? "bg-primary/5 border border-primary/10 ml-4" : "bg-muted/20"}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-semibold text-foreground">
                                {reply.is_admin ? "Support Team" : "You"}
                              </span>
                              {reply.is_admin && (
                                <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 font-normal px-1.5 py-0">Admin</Badge>
                              )}
                              <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(reply.created_at)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reply.body}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    {ticket.status !== "closed" && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          <MessageSquare size={12} className="inline mr-1.5" />Add Reply
                        </p>
                        <div className="flex gap-2">
                          <textarea
                            placeholder="Type your message..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={3}
                            className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                          />
                          <Button
                            onClick={handleSendReply}
                            disabled={!replyText.trim() || sendingReply}
                            size="icon"
                            className="h-auto aspect-square self-end rounded-lg"
                          >
                            {sendingReply ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
