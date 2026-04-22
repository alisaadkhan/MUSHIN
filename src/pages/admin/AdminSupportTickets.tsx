import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  LifeBuoy, MessageSquare, Clock, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Send, Loader2, XCircle, Search, Filter
} from "lucide-react";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface Ticket {
  id: string;
  ticket_number?: number | null;
  user_id: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: string;
  admin_notes: string | null;
  assigned_to?: string | null;
  assigned_at?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null };
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
  low: "bg-muted/20 text-muted-foreground",
  medium: "bg-blue-500/10 text-blue-400",
  high: "bg-amber-500/10 text-amber-400",
  urgent: "bg-red-500/10 text-red-400",
};

export default function AdminSupportTickets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: tickets = [], isLoading } = useQuery<Ticket[]>({
    queryKey: ["admin-support-tickets", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("support_tickets")
        .select("*, profiles!user_id(full_name, avatar_url)")
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        q = q.eq("status", filterStatus);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Ticket[];
    },
    refetchInterval: 60_000,
  });

  const { data: staff = [] } = useQuery<{ id: string; full_name: string | null }[]>({
    queryKey: ["admin-support-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["support", "admin", "super_admin"]);
      if (error) throw error;

      const ids = Array.from(new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean)));
      if (ids.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      if (pErr) throw pErr;
      return (profiles ?? []) as any;
    },
    staleTime: 60_000,
  });

  const { data: replies = [] } = useQuery<TicketReply[]>({
    queryKey: ["admin-ticket-replies", expandedTicket],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_replies")
        .select("*")
        .eq("ticket_id", expandedTicket!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TicketReply[];
    },
    enabled: !!expandedTicket,
  });

  const handleUpdateStatus = async (ticketId: string, status: TicketStatus) => {
    setUpdatingStatus(ticketId);
    try {
      const updates: any = { status };
      if (status === "resolved" || status === "closed") {
        updates.resolved_at = new Date().toISOString();
      }
      if (adminNotes.trim()) {
        updates.admin_notes = adminNotes.trim();
      }
      const { error } = await supabase.from("support_tickets").update(updates).eq("id", ticketId);
      if (error) throw error;
      toast({ title: `Ticket marked as ${status.replace("_", " ")}` });
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleSendReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("support_ticket_replies").insert({
        ticket_id: ticketId,
        author_id: user!.id,
        body: replyText.trim(),
        is_admin: true,
      });
      if (error) throw error;

      // Auto-progress status to in_progress if it was open
      const ticket = tickets.find((t) => t.id === ticketId);
      if (ticket?.status === "open") {
        await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", ticketId);
      }

      setReplyText("");
      qc.invalidateQueries({ queryKey: ["admin-ticket-replies", ticketId] });
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast({ title: "Reply sent" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSendingReply(false);
    }
  };

  const handleAssign = async (ticketId: string, assigneeId: string | null) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ assigned_to: assigneeId, assigned_at: assigneeId ? new Date().toISOString() : null })
        .eq("id", ticketId);
      if (error) throw error;
      toast({ title: assigneeId ? "Ticket assigned" : "Assignment cleared" });
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filtered = tickets.filter((t) =>
    search ? t.subject.toLowerCase().includes(search.toLowerCase()) : true
  );

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const counts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const staffById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of staff) m.set(s.id, s.full_name ?? s.id.slice(0, 8) + "…");
    return m;
  }, [staff]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Support Tickets</h1>
        <p className="text-muted-foreground">Manage and respond to user support requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(["open", "in_progress", "resolved", "closed"] as TicketStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
            className={`glass-card rounded-xl p-4 text-left transition-colors ${filterStatus === status ? "ring-1 ring-primary" : ""}`}
          >
            <p className="text-2xl font-bold text-foreground">{counts[status] || 0}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">{status.replace("_", " ")}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 bg-[#070707] border-border rounded-lg text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-lg bg-[#070707] border border-border text-sm text-foreground focus:outline-none focus:border-violet-500"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Tickets */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <LifeBuoy className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No tickets found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => {
            const isExpanded = expandedTicket === ticket.id;

            return (
              <div key={ticket.id} className="glass-card rounded-2xl overflow-hidden">
                <button
                  className="w-full px-6 py-4 flex items-center gap-4 hover:bg-muted/5 transition-colors text-left"
                  onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{ticket.subject}</p>
                      {typeof ticket.ticket_number === "number" && (
                        <Badge className="text-[10px] bg-muted/20 text-muted-foreground border-border px-2 rounded-md font-normal">
                          #{ticket.ticket_number}
                        </Badge>
                      )}
                      <Badge className={`text-[10px] border font-normal rounded-md px-2 ${priorityColors[ticket.priority]}`}>
                        {ticket.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(ticket.profiles as any)?.full_name || "Unknown"} · {ticket.category.replace("_", " ")} · {formatDate(ticket.created_at)}
                    </p>
                    {ticket.assigned_to && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Assigned to <span className="text-slate-200">{staffById.get(ticket.assigned_to) ?? `${ticket.assigned_to.slice(0, 8)}…`}</span>
                        {ticket.assigned_at ? <span className="text-muted-foreground/70"> · {formatDate(ticket.assigned_at)}</span> : null}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-[10px] border font-normal rounded-md px-2 ${statusColors[ticket.status]}`}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border/50 px-6 py-5 space-y-5">
                    {/* Assignment */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Assigned to:</span>
                      <select
                        value={ticket.assigned_to ?? ""}
                        onChange={(e) => handleAssign(ticket.id, e.target.value || null)}
                        className="h-8 px-2 rounded-lg bg-[#070707] border border-border text-xs text-foreground focus:outline-none focus:border-violet-500"
                      >
                        <option value="">Unassigned</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name || s.id.slice(0, 8) + "…"}
                          </option>
                        ))}
                      </select>
                      {user?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs rounded-lg"
                          onClick={() => handleAssign(ticket.id, user.id)}
                        >
                          Assign to me
                        </Button>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {ticket.assigned_to ? `by ${staffById.get(ticket.assigned_to) ?? "staff"}${ticket.assigned_at ? ` · ${formatDate(ticket.assigned_at)}` : ""}` : ""}
                      </span>
                    </div>

                    <div className="bg-muted/10 rounded-xl p-4">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{ticket.description}</p>
                    </div>

                    {/* Status Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Change status:</span>
                      {(["open", "in_progress", "resolved", "closed"] as TicketStatus[]).map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={ticket.status === s ? "default" : "outline"}
                          className="h-7 text-xs rounded-lg px-3"
                          onClick={() => handleUpdateStatus(ticket.id, s)}
                          disabled={updatingStatus === ticket.id || ticket.status === s}
                        >
                          {updatingStatus === ticket.id ? <Loader2 size={11} className="animate-spin" /> : s.replace("_", " ")}
                        </Button>
                      ))}
                    </div>

                    {/* Admin Notes */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal Notes</label>
                      <textarea
                        value={adminNotes || ticket.admin_notes || ""}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Private notes visible to admins only..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-[#070707] border border-border text-sm text-slate-300 placeholder:text-muted-foreground resize-none focus:outline-none focus:border-violet-500"
                      />
                    </div>

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversation</p>
                        {replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`rounded-xl p-4 ${reply.is_admin ? "bg-violet-500/5 border border-violet-500/10" : "bg-muted/10"}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-semibold text-foreground">{reply.is_admin ? "Support Team" : "User"}</span>
                              {reply.is_admin && (
                                <Badge className="text-[9px] bg-violet-500/10 text-violet-300 border-violet-500/20 font-normal px-1.5">Admin</Badge>
                              )}
                              <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(reply.created_at)}</span>
                            </div>
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{reply.body}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    {ticket.status !== "closed" && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reply to User</p>
                        <div className="flex gap-2">
                          <textarea
                            placeholder="Write a response to the user..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={3}
                            className="flex-1 px-3 py-2 rounded-lg bg-[#070707] border border-border text-sm text-slate-300 placeholder:text-muted-foreground focus:outline-none focus:border-violet-500 resize-none"
                          />
                          <Button
                            onClick={() => handleSendReply(ticket.id)}
                            disabled={!replyText.trim() || sendingReply}
                            size="icon"
                            className="h-auto aspect-square self-end rounded-lg bg-violet-600 hover:bg-violet-700"
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
