import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  Search,
  User,
  CreditCard,
  BarChart2,
  Headphones,
  LogOut,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  LifeBuoy,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  ClipboardList,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { MushInIcon } from "@/components/ui/MushInLogo";
import { useQuery } from "@tanstack/react-query";
import { useSupportPermissions } from "@/hooks/useSupportPermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invokeEdgeAuthed } from "@/lib/edge";

interface UserRecord {
  id: string;
  full_name: string | null;
  email: string | null;
  plan_name: string;
  subscription_status: string | null;
  search_count: number;
  monthly_limit: number;
  created_at: string | null;
}

type ActivityRow = {
  id: string;
  created_at: string;
  action_type: string;
  status: string;
  ip_address: string | null;
  device_info: string | null;
  metadata: any;
};

type SessionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  ip: string | null;
  user_agent: string | null;
};

type BillingSummary = {
  workspaces: Array<{ id: string; name: string | null; plan: string | null; owner_id: string | null; created_at: string | null }>;
  subscriptions: Array<{
    workspace_id: string;
    plan: string;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    updated_at: string | null;
  }>;
  paddle_subscriptions: Array<{
    workspace_id: string;
    status: string;
    plan: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    updated_at: string | null;
    created_at: string | null;
  }>;
  invoices: Array<{
    workspace_id: string;
    amount_paid: number | null;
    currency: string | null;
    status: string | null;
    invoice_pdf: string | null;
    created_at: string;
  }>;
};

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

type TicketRow = {
  id: string;
  ticket_number?: number | null;
  user_id: string;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  admin_notes?: string | null;
  assigned_to?: string | null;
  assigned_at?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null };
};

type TicketReplyRow = {
  id: string;
  ticket_id: string;
  author_id: string;
  is_admin: boolean;
  body: string;
  created_at: string;
};

const cannedResponses = [
  {
    id: "need-more-info",
    label: "Need more info",
    body:
      "Thanks for reaching out — I can help with that.\n\nCould you share:\n- the exact steps you took\n- what you expected vs what happened\n- any screenshots (if possible)\n\nOnce I have that, I’ll investigate and get back to you.",
  },
  {
    id: "we-are-investigating",
    label: "We’re investigating",
    body:
      "Thanks — we’re looking into this now.\n\nI’ll update you as soon as we have more information.",
  },
  {
    id: "resolved-confirm",
    label: "Resolved (confirm)",
    body:
      "We’ve deployed a fix on our side.\n\nCould you please refresh and confirm it’s working now?",
  },
] as const;

function StatusBadge({ status }: { status: string | null }) {
  if (!status || status === "free") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">Free</span>;
  }
  const map: Record<string, { color: string; label: string }> = {
    active:     { color: "bg-green-500/10 text-green-400 border border-green-500/20", label: "Active" },
    trialing:   { color: "bg-blue-500/10 text-blue-400 border border-blue-500/20",    label: "Trial" },
    past_due:   { color: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20", label: "Past Due" },
    canceled:   { color: "bg-red-500/10 text-red-400 border border-red-500/20",       label: "Canceled" },
    paused:     { color: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",    label: "Paused" },
  };
  const { color, label } = map[status] ?? { color: "bg-zinc-800 text-zinc-400", label: status };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

function UsageBar({ count, limit }: { count: number; limit: number }) {
  const pct = limit > 0 ? Math.min((count / limit) * 100, 100) : 0;
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-teal-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/50">
        <span>{count.toLocaleString()} used</span>
        <span>{limit.toLocaleString()} limit</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SupportDashboard() {
  const { user, signOut } = useAuth();
  const { data: supportPerms } = useSupportPermissions();
  const [mode, setMode] = useState<"lookup" | "inbox">("lookup");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<UserRecord[]>([]);
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Inbox state
  const [inboxFilter, setInboxFilter] = useState<"all" | TicketStatus>("all");
  const [inboxSearch, setInboxSearch] = useState("");
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [internalNoteDraft, setInternalNoteDraft] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [updatingTicket, setUpdatingTicket] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonationReason, setImpersonationReason] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setHasSearched(true);
    setSelected(null);

    try {
      const { data, error } = await invokeEdgeAuthed<{ users: UserRecord[] }>("support-users-search", {
        body: { query: query.trim() },
      } as any);
      if (error) throw error;
      setResults(((data as any)?.users ?? []) as UserRecord[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lookup failed";
      toast({ title: "Search failed", description: msg, variant: "destructive" });
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleViewUser = async (record: UserRecord) => {
    setSelected(record);
    // Logged server-side by support APIs; keep UI non-blocking.
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const logSupportAction = async () => {
    // Deprecated: support panel uses edge APIs that log server-side.
  };

  const { data: recentTickets = [], isLoading: ticketsLoading, error: ticketsError } = useQuery<any[]>({
    queryKey: ["support-recent-tickets"],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ tickets: any[] }>("support-tickets", {
        body: { action: "list", status: "all", limit: 50 },
      } as any);
      if (error) throw error;
      return ((data as any)?.tickets ?? []) as any[];
    },
    staleTime: 15_000,
    retry: false,
  });

  const ticketCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const t of recentTickets) acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, [recentTickets]);

  const { data: inboxTickets = [], isLoading: inboxLoading, error: inboxError, refetch: refetchInbox } = useQuery<TicketRow[]>({
    queryKey: ["support-inbox", inboxFilter],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ tickets: TicketRow[] }>("support-tickets", {
        body: { action: "list", status: inboxFilter, limit: 200 },
      } as any);
      if (error) throw error;
      return (((data as any)?.tickets ?? []) as TicketRow[]) ?? [];
    },
    enabled: !!supportPerms?.canViewTickets,
    staleTime: 15_000,
    retry: false,
  });

  const filteredInbox = useMemo(() => {
    const needle = inboxSearch.trim().toLowerCase();
    if (!needle) return inboxTickets;
    return inboxTickets.filter((t) => {
      const parts = [
        t.subject,
        t.description,
        t.status,
        t.priority,
        t.category,
        t.profiles?.full_name ?? "",
        String(t.ticket_number ?? ""),
      ];
      return parts.some((p) => (p ?? "").toLowerCase().includes(needle));
    });
  }, [inboxTickets, inboxSearch]);

  const expanded = useMemo(
    () => (expandedTicket ? inboxTickets.find((t) => t.id === expandedTicket) ?? null : null),
    [expandedTicket, inboxTickets],
  );

  const { data: ticketReplies = [], isLoading: repliesLoading } = useQuery<TicketReplyRow[]>({
    queryKey: ["support-ticket-replies", expandedTicket],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ messages: any[] }>("support-tickets", {
        body: { action: "messages", ticket_id: expandedTicket! },
      } as any);
      if (error) throw error;
      // Map new support_messages shape into the existing UI shape (is_admin inferred).
      return (((data as any)?.messages ?? []) as any[]).map((m) => ({
        id: m.id,
        ticket_id: m.ticket_id,
        author_id: m.author_id,
        is_admin: m.visibility !== "user",
        body: m.body,
        created_at: m.created_at,
      })) as TicketReplyRow[];
    },
    enabled: !!expandedTicket && !!supportPerms?.canViewTickets,
    staleTime: 15_000,
    retry: false,
  });

  const { data: staff = [] } = useQuery<Array<{ id: string; full_name: string | null }>>({
    queryKey: ["support-staff-directory"],
    queryFn: async () => {
      // TODO: expose a dedicated edge endpoint for staff directory.
      return [];
    },
    enabled: !!supportPerms?.canAssignTickets,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!expanded) return;
    setInternalNoteDraft(expanded.admin_notes ?? "");
  }, [expanded?.id]);

  const updateTicket = async (ticketId: string, updates: Partial<TicketRow>, action: string, meta?: Record<string, unknown>) => {
    setUpdatingTicket(ticketId);
    try {
      const { error } = await invokeEdgeAuthed("support-tickets", {
        body: { action: "update", ticket_id: ticketId, updates, reason: action },
      } as any);
      if (error) throw error;
      await refetchInbox();
      toast({ title: "Updated" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingTicket(null);
    }
  };

  const handleAssign = async (ticketId: string, assigneeId: string | null) => {
    if (!supportPerms?.canAssignTickets) {
      toast({ title: "Not allowed", description: "Your tier can’t assign tickets.", variant: "destructive" });
      return;
    }
    await updateTicket(
      ticketId,
      { assigned_to: assigneeId, assigned_at: assigneeId ? new Date().toISOString() : null } as any,
      "ticket_assign",
      { assigned_to: assigneeId },
    );
  };

  const handleStatus = async (ticketId: string, status: TicketStatus) => {
    await updateTicket(ticketId, { status } as any, "ticket_status", { status });
  };

  const handleSaveInternalNote = async () => {
    if (!expanded) return;
    if (!supportPerms?.canWriteInternalNotes) {
      toast({ title: "Not allowed", description: "Your tier can’t write internal notes.", variant: "destructive" });
      return;
    }
    setSavingNote(true);
    try {
      const { error } = await invokeEdgeAuthed("support-tickets", {
        body: {
          action: "post_message",
          ticket_id: expanded.id,
          visibility: "internal",
          body: internalNoteDraft.trim(),
        },
      } as any);
      if (error) throw error;
      await refetchInbox();
      toast({ title: "Internal note saved" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const handleSendReply = async () => {
    if (!expanded) return;
    if (!replyDraft.trim()) return;
    setSavingReply(true);
    try {
      const { error } = await invokeEdgeAuthed("support-tickets", {
        body: {
          action: "post_message",
          ticket_id: expanded.id,
          visibility: "user",
          body: replyDraft.trim(),
        },
      } as any);
      if (error) throw error;
      setReplyDraft("");
      await refetchInbox();
      toast({ title: "Reply sent" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingReply(false);
    }
  };

  const { data: selectedTickets = [], isLoading: selectedTicketsLoading } = useQuery<any[]>({
    queryKey: ["support-selected-user-tickets", selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id,ticket_number,subject,status,priority,created_at,updated_at")
        .eq("user_id", selected!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selected?.id && !!supportPerms?.canViewTickets,
    staleTime: 15_000,
    retry: false,
  });

  const { data: selectedActivity = [], isLoading: selectedActivityLoading, error: selectedActivityError } = useQuery<ActivityRow[]>({
    queryKey: ["support-selected-user-activity", selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("support_get_user_activity_logs", {
        p_user_id: selected!.id,
        p_limit: 200,
      });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
    enabled: !!selected?.id && !!supportPerms?.canViewActivityLogs,
    staleTime: 15_000,
    retry: false,
  });

  const { data: selectedSessions = [], isLoading: selectedSessionsLoading, error: selectedSessionsError } = useQuery<SessionRow[]>({
    queryKey: ["support-selected-user-sessions", selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("support_get_user_sessions", {
        p_user_id: selected!.id,
      });
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
    enabled: !!selected?.id && !!supportPerms?.canViewSessions,
    staleTime: 15_000,
    retry: false,
  });

  const { data: billingSummary, isLoading: billingLoading, error: billingError } = useQuery<BillingSummary>({
    queryKey: ["support-selected-user-billing", selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("support_get_user_billing_summary", {
        p_user_id: selected!.id,
        p_limit_invoices: 20,
      });
      if (error) throw error;
      return (data ?? { workspaces: [], subscriptions: [], paddle_subscriptions: [], invoices: [] }) as BillingSummary;
    },
    enabled: !!selected?.id && !!supportPerms?.canViewBilling,
    staleTime: 30_000,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      {/* Top nav */}
      <header className="border-b border-white/[0.06] px-6 py-3 flex items-center justify-between sticky top-0 z-50 bg-[#060608]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <MushInIcon size={28} className="text-teal-400" />
          <div>
            <span className="text-sm font-bold tracking-widest text-white">MUSHIN</span>
            <div className="flex items-center gap-1.5">
              <Headphones className="w-3 h-3 text-teal-400" />
              <span className="text-[10px] text-teal-400 font-medium uppercase tracking-wider">Support Dashboard</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/40">{user?.email}</span>
          {supportPerms?.tier ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-teal-500/25 bg-teal-500/10 text-teal-200/80">
              Support {supportPerms.tier}
            </span>
          ) : null}
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white/50 hover:text-white gap-1.5">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Mode switch */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("lookup")}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
              mode === "lookup" ? "border-teal-500/30 bg-teal-500/10 text-teal-200" : "border-white/10 bg-white/[0.02] text-white/60 hover:text-white"
            }`}
          >
            User Lookup
          </button>
          <button
            onClick={() => setMode("inbox")}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-all inline-flex items-center gap-2 ${
              mode === "inbox" ? "border-teal-500/30 bg-teal-500/10 text-teal-200" : "border-white/10 bg-white/[0.02] text-white/60 hover:text-white"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Inbox
          </button>
        </div>

        {mode === "inbox" && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-2xl font-black tracking-tight">Support Inbox</h1>
                <p className="text-white/40 text-sm mt-1">Tickets, assignment, internal notes, and replies.</p>
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={() => refetchInbox()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {!supportPerms?.canViewTickets ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-white/40 text-sm">
                Your tier can’t view tickets.
              </div>
            ) : inboxError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-5 text-red-200/90">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4" /> Unable to load inbox
                </div>
                <div className="text-xs text-red-200/70 mt-2">{(inboxError as any)?.message ?? "Failed"}</div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Left: ticket list */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={inboxFilter}
                      onChange={(e) => setInboxFilter(e.target.value as any)}
                      className="h-9 px-3 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none"
                    >
                      <option value="all">All</option>
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        value={inboxSearch}
                        onChange={(e) => setInboxSearch(e.target.value)}
                        placeholder="Search tickets…"
                        className="w-full h-9 bg-white/[0.03] border border-white/10 rounded-lg pl-10 pr-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                      />
                    </div>
                  </div>

                  {inboxLoading ? (
                    <div className="py-10 text-center text-white/40">
                      <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
                      Loading…
                    </div>
                  ) : filteredInbox.length === 0 ? (
                    <div className="py-10 text-center text-white/40">No tickets found.</div>
                  ) : (
                    <div className="space-y-2 max-h-[540px] overflow-auto pr-1">
                      {filteredInbox.map((t) => {
                        const active = expandedTicket === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={async () => {
                              setExpandedTicket(active ? null : t.id);
                              await logSupportAction("ticket_view", t.user_id, { ticket_id: t.id });
                            }}
                            className={`w-full text-left rounded-xl border p-3 transition-all ${
                              active
                                ? "border-teal-500/40 bg-teal-500/[0.06]"
                                : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">
                                  {t.subject}{" "}
                                  {typeof t.ticket_number === "number" ? (
                                    <span className="text-white/30 font-mono">#{t.ticket_number}</span>
                                  ) : null}
                                </div>
                                <div className="text-xs text-white/40 mt-0.5 truncate">
                                  {t.profiles?.full_name ?? t.user_id.slice(0, 8) + "…"} · {t.status} · {t.priority}
                                </div>
                              </div>
                              {active ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right: ticket detail */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  {!expanded ? (
                    <div className="py-16 text-center text-white/40">
                      <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      Select a ticket to view details.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-black truncate">{expanded.subject}</div>
                          <div className="text-xs text-white/40 mt-1">
                            {expanded.status} · {expanded.priority} · {new Date(expanded.created_at).toLocaleString()}
                          </div>
                          <div className="text-xs text-white/35 mt-1">
                            User: <span className="font-mono">{expanded.user_id}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={expanded.status}
                            onChange={(e) => handleStatus(expanded.id, e.target.value as TicketStatus)}
                            disabled={updatingTicket === expanded.id}
                            className="h-9 px-3 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9"
                            disabled={!supportPerms?.canAssignTickets || updatingTicket === expanded.id}
                            onClick={() => handleAssign(expanded.id, user?.id ?? null)}
                          >
                            Assign to me
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm text-white/80 whitespace-pre-wrap">
                        {expanded.description}
                      </div>

                      {/* Assignment */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-xs text-white/40">Assigned to</div>
                        <select
                          value={expanded.assigned_to ?? ""}
                          onChange={(e) => handleAssign(expanded.id, e.target.value || null)}
                          disabled={!supportPerms?.canAssignTickets || updatingTicket === expanded.id}
                          className="h-9 px-3 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white focus:outline-none min-w-[220px]"
                        >
                          <option value="">Unassigned</option>
                          {staff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name ?? s.id.slice(0, 8) + "…"}
                            </option>
                          ))}
                        </select>
                        {expanded.assigned_at ? (
                          <span className="text-[11px] text-white/30">
                            at {new Date(expanded.assigned_at).toLocaleString()}
                          </span>
                        ) : null}
                      </div>

                      {/* Internal notes */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-white/40 uppercase tracking-widest">Internal notes</div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={!supportPerms?.canWriteInternalNotes || savingNote}
                            onClick={handleSaveInternalNote}
                          >
                            {savingNote ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                            Save
                          </Button>
                        </div>
                        <textarea
                          value={internalNoteDraft}
                          onChange={(e) => setInternalNoteDraft(e.target.value)}
                          rows={3}
                          disabled={!supportPerms?.canWriteInternalNotes}
                          placeholder={supportPerms?.canWriteInternalNotes ? "Private notes (not visible to user)..." : "Not allowed"}
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none resize-none"
                        />
                      </div>

                      {/* Replies */}
                      <div className="space-y-2">
                        <div className="text-xs text-white/40 uppercase tracking-widest">Conversation</div>
                        <div className="space-y-2 max-h-56 overflow-auto pr-1">
                          {repliesLoading ? (
                            <div className="text-white/40 text-sm">Loading…</div>
                          ) : ticketReplies.length === 0 ? (
                            <div className="text-white/40 text-sm">No replies yet.</div>
                          ) : (
                            ticketReplies.map((r) => (
                              <div
                                key={r.id}
                                className={`rounded-xl border p-3 ${
                                  r.is_admin ? "border-teal-500/20 bg-teal-500/[0.06]" : "border-white/[0.08] bg-white/[0.02]"
                                }`}
                              >
                                <div className="text-[11px] text-white/40">
                                  {r.is_admin ? "Support" : "User"} · {new Date(r.created_at).toLocaleString()}
                                </div>
                                <div className="text-sm text-white/80 whitespace-pre-wrap mt-1">{r.body}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Reply composer */}
                      {expanded.status !== "closed" ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-xs text-white/40 uppercase tracking-widest">Reply</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {cannedResponses.map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => setReplyDraft(t.body)}
                                  className="text-[11px] px-2 py-1 rounded border border-white/10 bg-white/[0.02] text-white/60 hover:text-white/80"
                                  type="button"
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea
                            value={replyDraft}
                            onChange={(e) => setReplyDraft(e.target.value)}
                            rows={4}
                            placeholder="Write a reply to the user…"
                            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none resize-none"
                          />
                          <div className="flex justify-end">
                            <Button onClick={handleSendReply} disabled={!replyDraft.trim() || savingReply} className="bg-teal-600 hover:bg-teal-500">
                              {savingReply ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                              Send
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-white/40 text-sm">Ticket is closed.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {mode === "lookup" && (
          <>
            {/* Search section */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">User Lookup</h1>
            <p className="text-white/40 text-sm mt-1">Search users by email. All lookups are logged.</p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email (partial match supported)…"
                className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/40 focus:bg-white/[0.06] transition-all"
              />
            </div>
            <Button type="submit" disabled={searching || !query.trim()}
              className="bg-teal-600 hover:bg-teal-500 text-white h-10 px-5">
              {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </form>
            </motion.div>

            {/* Results */}
            {hasSearched && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {results.length === 0 && !searching && (
              <div className="text-center py-12 text-white/30">
                <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No users found matching "{query}"</p>
              </div>
            )}
            {results.map((r) => (
              <div key={r.id}
                onClick={() => handleViewUser(r)}
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                  selected?.id === r.id
                    ? "border-teal-500/40 bg-teal-500/[0.06]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-sm font-bold text-teal-400">
                    {(r.full_name ?? r.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{r.full_name ?? "—"}</div>
                    <div className="text-xs text-white/40">{r.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.subscription_status ?? r.plan_name} />
                  <span className="text-xs text-white/30 hidden sm:block capitalize">{r.plan_name}</span>
                </div>
              </div>
            ))}
          </motion.div>
            )}

            {/* User detail panel */}
            {selected && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="grid sm:grid-cols-3 gap-4">

            {/* Identity card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest mb-1">
                <User className="w-3.5 h-3.5" /> Identity
              </div>
              <div>
                <div className="text-lg font-bold">{selected.full_name ?? "—"}</div>
                <div className="text-sm text-white/50 break-all">{selected.email}</div>
              </div>
              <div className="text-xs text-white/30 font-mono break-all">{selected.id}</div>
              {selected.created_at && (
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <Clock className="w-3 h-3" />
                  Period ends: {new Date(selected.created_at).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Subscription card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest mb-1">
                <CreditCard className="w-3.5 h-3.5" /> Subscription
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selected.subscription_status} />
                <span className="text-sm font-semibold capitalize">{selected.plan_name}</span>
              </div>
              {selected.subscription_status === "active" ? (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" /> Subscription active
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <AlertCircle className="w-3.5 h-3.5" /> {selected.plan_name === "free" ? "Free plan" : "Inactive"}
                </div>
              )}
              <p className="text-[10px] text-white/25">Support cannot modify billing. Direct billing queries to admin.</p>
            </div>

            {/* Usage card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest mb-1">
                <BarChart2 className="w-3.5 h-3.5" /> Usage
              </div>
              <div>
                <div className="text-3xl font-black">{selected.search_count.toLocaleString()}</div>
                <div className="text-xs text-white/40">searches this period</div>
              </div>
              <UsageBar count={selected.search_count} limit={selected.monthly_limit} />
              {selected.search_count >= selected.monthly_limit && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5" /> Limit reached
                </div>
              )}
            </div>
          </motion.div>
            )}

            {/* Selected user diagnostics */}
            {selected && (
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-black tracking-tight">Diagnostics</h2>
                <p className="text-white/40 text-sm mt-1">
                  Read-only diagnostics for the selected user (tier-gated).
                </p>
              </div>
              <div className="text-xs text-white/35 font-mono">
                {selected.id.slice(0, 8)}…
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <Tabs
                defaultValue={
                  supportPerms?.canViewTickets
                    ? "tickets"
                    : supportPerms?.canViewBilling
                      ? "billing"
                      : supportPerms?.canViewActivityLogs
                        ? "activity"
                        : "sessions"
                }
              >
                <TabsList className="bg-white/5">
                  <TabsTrigger value="tickets" disabled={!supportPerms?.canViewTickets}>Tickets</TabsTrigger>
                  <TabsTrigger value="billing" disabled={!supportPerms?.canViewBilling}>Billing</TabsTrigger>
                  <TabsTrigger value="activity" disabled={!supportPerms?.canViewActivityLogs}>Activity</TabsTrigger>
                  <TabsTrigger value="sessions" disabled={!supportPerms?.canViewSessions}>Sessions</TabsTrigger>
                </TabsList>

                <TabsContent value="tickets" className="mt-4">
                  {!supportPerms?.canViewTickets ? (
                    <div className="text-white/40 text-sm">Your tier can’t view tickets.</div>
                  ) : selectedTicketsLoading ? (
                    <div className="text-white/40 text-sm"><RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />Loading…</div>
                  ) : selectedTickets.length === 0 ? (
                    <div className="text-white/40 text-sm">No tickets for this user.</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTickets.map((t) => (
                        <div key={t.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">
                                {t.subject}{" "}
                                {typeof t.ticket_number === "number" ? <span className="text-white/30 font-mono">#{t.ticket_number}</span> : null}
                              </div>
                              <div className="text-xs text-white/40 mt-0.5">
                                {t.status} · {t.priority} · {new Date(t.created_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  {!supportPerms?.canViewActivityLogs ? (
                    <div className="text-white/40 text-sm">Your tier can’t view activity logs.</div>
                  ) : selectedActivityLoading ? (
                    <div className="text-white/40 text-sm"><RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />Loading…</div>
                  ) : selectedActivityError ? (
                    <div className="text-red-200/90 text-sm">{(selectedActivityError as any)?.message ?? "Failed to load activity."}</div>
                  ) : selectedActivity.length === 0 ? (
                    <div className="text-white/40 text-sm">No activity logs found.</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedActivity.slice(0, 50).map((a) => (
                        <div key={a.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{a.action_type}</div>
                              <div className="text-xs text-white/40 mt-0.5">
                                {a.status} · {new Date(a.created_at).toLocaleString()}
                                {a.ip_address ? ` · IP: ${a.ip_address}` : ""}
                              </div>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              a.status === "error"
                                ? "border-red-500/25 bg-red-500/10 text-red-200/80"
                                : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200/80"
                            }`}>
                              {a.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {selectedActivity.length > 50 ? (
                        <div className="text-[11px] text-white/30">Showing latest 50 of {selectedActivity.length}.</div>
                      ) : null}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="billing" className="mt-4">
                  {!supportPerms?.canViewBilling ? (
                    <div className="text-white/40 text-sm">Your tier can’t view billing.</div>
                  ) : billingLoading ? (
                    <div className="text-white/40 text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
                      Loading…
                    </div>
                  ) : billingError ? (
                    <div className="text-red-200/90 text-sm">
                      {(billingError as any)?.message ?? "Failed to load billing."}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                        <div className="text-xs text-white/40 uppercase tracking-widest">Workspaces</div>
                        {billingSummary?.workspaces?.length ? (
                          <div className="mt-2 space-y-2">
                            {billingSummary.workspaces.map((w) => (
                              <div key={w.id} className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold truncate">{w.name ?? "Workspace"}</div>
                                  <div className="text-[11px] text-white/35 font-mono">{w.id.slice(0, 8)}…</div>
                                </div>
                                <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.02] text-white/70 capitalize">
                                  {w.plan ?? "free"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-white/40 text-sm mt-2">No owned workspaces found.</div>
                        )}
                      </div>

                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                        <div className="text-xs text-white/40 uppercase tracking-widest">Subscription status</div>
                        <div className="mt-2 space-y-2">
                          {(billingSummary?.subscriptions ?? []).map((s, idx) => (
                            <div key={`${s.workspace_id}-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold capitalize">{s.plan}</div>
                                <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.02] text-white/70">
                                  {s.status}
                                </span>
                              </div>
                              <div className="text-xs text-white/40 mt-1">
                                Period: {s.current_period_start ? new Date(s.current_period_start).toLocaleDateString() : "—"} →{" "}
                                {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                                {s.cancel_at_period_end ? " · cancels at period end" : ""}
                              </div>
                            </div>
                          ))}
                          {(billingSummary?.subscriptions ?? []).length === 0 ? (
                            <div className="text-white/40 text-sm">No subscription rows found.</div>
                          ) : null}
                        </div>

                        {(billingSummary?.paddle_subscriptions ?? []).length ? (
                          <div className="mt-3">
                            <div className="text-[11px] text-white/35 uppercase tracking-widest">Paddle</div>
                            <div className="mt-2 space-y-2">
                              {billingSummary.paddle_subscriptions.map((ps, idx) => (
                                <div key={`${ps.workspace_id}-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold capitalize">{ps.plan}</div>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.02] text-white/70">
                                      {ps.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-white/40 mt-1">
                                    Period end: {ps.current_period_end ? new Date(ps.current_period_end).toLocaleDateString() : "—"}
                                    {ps.cancel_at_period_end ? " · cancels at period end" : ""}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                        <div className="text-xs text-white/40 uppercase tracking-widest">Invoices</div>
                        {billingSummary?.invoices?.length ? (
                          <div className="mt-2 space-y-2">
                            {billingSummary.invoices.map((inv, idx) => (
                              <div key={`${inv.workspace_id}-${idx}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold">
                                    {inv.amount_paid != null ? `$${(inv.amount_paid / 100).toFixed(2)}` : "—"}{" "}
                                    <span className="text-white/30 text-xs uppercase">{inv.currency ?? ""}</span>
                                  </div>
                                  <div className="text-xs text-white/40">
                                    {inv.status ?? "—"} · {new Date(inv.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                                {inv.invoice_pdf ? (
                                  <a
                                    href={inv.invoice_pdf}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] px-2 py-1 rounded border border-white/10 bg-white/[0.02] text-white/70 hover:text-white"
                                  >
                                    PDF
                                  </a>
                                ) : (
                                  <span className="text-[11px] text-white/30">No PDF</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-white/40 text-sm mt-2">No invoices found.</div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sessions" className="mt-4">
                  {!supportPerms?.canViewSessions ? (
                    <div className="text-white/40 text-sm">Your tier can’t view sessions.</div>
                  ) : selectedSessionsLoading ? (
                    <div className="text-white/40 text-sm"><RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />Loading…</div>
                  ) : selectedSessionsError ? (
                    <div className="text-red-200/90 text-sm">{(selectedSessionsError as any)?.message ?? "Failed to load sessions."}</div>
                  ) : selectedSessions.length === 0 ? (
                    <div className="text-white/40 text-sm">No sessions found.</div>
                  ) : (
                    <div className="space-y-2">
                      {selectedSessions.slice(0, 25).map((s) => (
                        <div key={s.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                          <div className="text-sm font-semibold">Session</div>
                          <div className="text-xs text-white/40 mt-0.5">
                            Last active: {new Date(s.updated_at).toLocaleString()} · IP: <span className="font-mono">{s.ip ?? "—"}</span>
                          </div>
                          {s.user_agent ? (
                            <div className="text-[10px] text-white/35 font-mono break-all mt-2">{s.user_agent}</div>
                          ) : null}
                        </div>
                      ))}
                      {selectedSessions.length > 25 ? (
                        <div className="text-[11px] text-white/30">Showing latest 25 of {selectedSessions.length}.</div>
                      ) : null}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {supportPerms?.canImpersonate ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold text-red-200">Limited impersonation</div>
                    <div className="text-xs text-red-200/70 mt-1">
                      This generates a one-time magic link. Open it in an incognito window to avoid losing your support session.
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    disabled={impersonating || !impersonationReason.trim()}
                    onClick={async () => {
                      if (!selected) return;
                      setImpersonating(true);
                      try {
                        const { data, error } = await invokeEdgeAuthed<{ action_link: string; error?: string }>(
                          "support-impersonate-user",
                          { body: { target_user_id: selected.id, reason: impersonationReason.trim() } } as any,
                        );
                        if (error) throw error;
                        if ((data as any)?.error) throw new Error(String((data as any).error));
                        const link = (data as any)?.action_link as string | undefined;
                        if (!link) throw new Error("No action link returned");
                        window.open(link, "_blank", "noopener,noreferrer");
                        toast({ title: "Impersonation link opened", description: "Use incognito for best results." });
                        setImpersonationReason("");
                      } catch (err: any) {
                        toast({ title: "Failed", description: err.message, variant: "destructive" });
                      } finally {
                        setImpersonating(false);
                      }
                    }}
                  >
                    {impersonating ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    Login as user
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-red-200/70 uppercase tracking-widest">Reason (required)</div>
                  <input
                    value={impersonationReason}
                    onChange={(e) => setImpersonationReason(e.target.value)}
                    placeholder="e.g. reproduce onboarding bug"
                    className="w-full h-9 bg-white/[0.03] border border-red-500/20 rounded-lg px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                  />
                </div>
              </div>
            ) : null}
          </motion.div>
            )}
          </>
        )}

        {/* Activity notice */}
        <div className="rounded-xl border border-yellow-500/15 bg-yellow-500/[0.04] p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-400/80 leading-relaxed">
            All actions in this dashboard are logged to the support audit trail. You have read-only access to user data. To modify subscriptions or credits, contact a super admin.
          </p>
        </div>

        {/* Tickets */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-black tracking-tight">Tickets</h2>
              <p className="text-white/40 text-sm mt-1">
                Latest tickets (requires `support_tickets` staff RLS).
              </p>
            </div>
            <div className="text-xs text-white/35 flex items-center gap-3">
              <span>Open: {ticketCounts.open ?? 0}</span>
              <span>In progress: {ticketCounts.in_progress ?? 0}</span>
              <span>Resolved: {ticketCounts.resolved ?? 0}</span>
            </div>
          </div>

          {ticketsLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/40">
              <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
              Loading tickets…
            </div>
          ) : ticketsError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-5 text-red-200/90">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4" />
                Unable to read `support_tickets`
              </div>
              <div className="text-xs text-red-200/70 mt-2">
                {(ticketsError as any)?.message ?? "Permission denied or RLS blocked."}
              </div>
            </div>
          ) : recentTickets.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/40">
              <LifeBuoy className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tickets found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTickets.map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-all p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {t.subject}{" "}
                      {typeof t.ticket_number === "number" ? (
                        <span className="text-white/30 font-mono">#{t.ticket_number}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {t.status} · {t.priority} · {new Date(t.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs text-white/35 font-mono flex-shrink-0">
                    {String(t.user_id).slice(0, 8)}…
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
