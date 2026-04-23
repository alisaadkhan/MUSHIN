import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeAuthed } from "@/lib/edge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Mail,
  MonitorSmartphone,
  History,
  CreditCard,
  Key,
  Shield,
  UserCheck,
  UserX,
} from "lucide-react";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  plan: string | null;
  suspended: boolean;
  created_at: string;
  last_sign_in: string | null;
};

type ActivityLogRow = {
  id: string;
  created_at: string;
  action_type: string;
  status: "success" | "error";
  ip_address?: string | null;
  device_info?: string | null;
  metadata?: unknown;
};

type SessionRow = {
  id?: string | null;
  device?: string | null;
  ip?: string | null;
  updated_at: string;
  raw_user_agent?: string | null;
};

type SubscriptionRow = {
  subscription: {
    id: string;
    workspace_id: string;
    plan: string;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    created_at: string;
  };
  workspace: { id: string; name: string; plan: string | null; owner_id: string | null } | null;
  owner: { id: string; email: string | null; full_name: string | null; country: string | null } | null;
};

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";
type Ticket = {
  id: string;
  ticket_number?: number | null;
  user_id: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: string;
  created_at: string;
  updated_at: string;
  assigned_to?: string | null;
};

function timeAgo(iso: string | null) {
  if (!iso) return "Never";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminUserDetail() {
  const { id: userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<UserRow[]>({
    queryKey: ["admin-users-v2"],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed("admin-list-users");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data.users ?? []) as UserRow[];
    },
    staleTime: 30_000,
    retry: false,
  });

  const user = useMemo(() => allUsers.find((u) => u.id === userId) ?? null, [allUsers, userId]);

  const callAdmin = async (fn: string, body: object) => {
    const { data, error } = await invokeEdgeAuthed(fn, { body } as any);
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const doAction = async (key: string, fn: string, body: object, successTitle: string) => {
    setActionLoading(key);
    try {
      await callAdmin(fn, body);
      toast({ title: successTitle });
      qc.invalidateQueries({ queryKey: ["admin-users-v2"] });
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<SessionRow[]>({
    queryKey: ["admin-user-sessions", userId],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed("admin-get-sessions", {
        body: { userId },
      } as any);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.sessions ?? []) as SessionRow[];
    },
    enabled: !!userId,
    staleTime: 15_000,
    retry: false,
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery<ActivityLogRow[]>({
    queryKey: ["admin-user-activity", userId],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed("admin-get-activity-log", {
        body: { userId, limit: 500 },
      } as any);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.logs ?? []) as ActivityLogRow[];
    },
    enabled: !!userId,
    staleTime: 15_000,
    retry: false,
  });

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<SubscriptionRow[]>({
    queryKey: ["admin-user-subscriptions", userId],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ rows: SubscriptionRow[]; error?: string }>(
        "admin-list-subscriptions",
        {
          method: "GET",
          search: new URLSearchParams({ limit: "500", active_only: "0" }).toString(),
        } as any,
      );
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      const rows = (data?.rows ?? []) as SubscriptionRow[];
      return rows.filter((r) => r.owner?.id === userId);
    },
    enabled: !!userId,
    staleTime: 30_000,
    retry: false,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["admin-user-tickets", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
    enabled: !!userId,
    staleTime: 15_000,
    retry: false,
  });

  if (!userId) {
    return (
      <div className="p-8">
        <div className="app-card p-6">
          <p className="text-white/70 text-sm">Missing user id in route.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/users")}>
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  if (usersLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-16 text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 space-y-4">
        <div className="section-header">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-9" onClick={() => navigate("/admin/users")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="section-title">User not found</h1>
              <p className="section-subtitle">This user id isn’t in `admin-list-users`.</p>
            </div>
          </div>
        </div>
        <div className="app-card p-6">
          <p className="text-white/40 text-sm font-mono">{userId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="section-header">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" className="h-9" onClick={() => navigate("/admin/users")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="section-title">{user.full_name || user.email || "User"}</h1>
            <p className="section-subtitle">
              <span className="font-mono">{user.id}</span>
              {" · "}
              Last sign-in: {timeAgo(user.last_sign_in)}
              {" · "}
              Joined: {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="capitalize">
              {user.plan ?? "free"}
            </Badge>
            <Badge
              variant="outline"
              className={user.suspended ? "border-red-500/30 text-red-300" : "border-emerald-500/30 text-emerald-300"}
            >
              {user.suspended ? "Suspended" : "Active"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-4">
          <Button
            variant={user.suspended ? "outline" : "destructive"}
            size="sm"
            className="h-9 rounded-lg"
            disabled={!!actionLoading}
            onClick={() =>
              doAction(
                user.suspended ? "unsuspend" : "suspend",
                "admin-suspend-user",
                { target_user_id: user.id, suspend: !user.suspended },
                user.suspended ? "User reactivated" : "User suspended",
              )
            }
          >
            {actionLoading === "suspend" || actionLoading === "unsuspend" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : user.suspended ? (
              <UserCheck className="h-4 w-4 mr-2" />
            ) : (
              <UserX className="h-4 w-4 mr-2" />
            )}
            {user.suspended ? "Unsuspend" : "Suspend"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
            disabled={!!actionLoading}
            onClick={() =>
              doAction("reset-pw", "admin-force-password-reset", { target_user_id: user.id }, "Password reset email sent")
            }
          >
            {actionLoading === "reset-pw" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Key className="h-4 w-4 mr-2" />
            )}
            Force reset
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg"
            disabled={!!actionLoading}
            onClick={() =>
              doAction("revoke", "admin-revoke-sessions", { target_user_id: user.id }, "All sessions revoked")
            }
          >
            {actionLoading === "revoke" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Revoke sessions
          </Button>

          <Button asChild variant="ghost" size="sm" className="h-9 rounded-lg text-white/70">
            <Link to="/admin/subscriptions">
              <CreditCard className="h-4 w-4 mr-2" />
              Subscriptions
            </Link>
          </Button>

          <Button asChild variant="ghost" size="sm" className="h-9 rounded-lg text-white/70">
            <Link to="/admin/users">
              <Mail className="h-4 w-4 mr-2" />
              Notify (from list)
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-white/5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="sessions">Devices</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="app-card p-6 space-y-3">
            <div className="text-sm text-white/70">
              <div className="flex items-center justify-between gap-3">
                <span>Email</span>
                <span className="font-mono text-white/60">{user.email ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Name</span>
                <span className="text-white/60">{user.full_name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Role</span>
                <span className="font-mono text-white/60">{user.role}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Plan</span>
                <span className="font-mono text-white/60">{user.plan ?? "free"}</span>
              </div>
            </div>
            <p className="text-[11px] text-white/30">
              Tip: this page is read-optimized; heavy actions (notify, change plan, role) still live in `AdminUsers` for now.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="subscription">
          <div className="app-card p-6">
            {subsLoading ? (
              <div className="flex items-center justify-center py-10 text-white/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="text-white/40 text-sm">No subscription rows found for this user.</div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((r) => (
                  <div key={r.subscription.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-white/80 truncate">
                          {r.workspace?.name ?? "Workspace"}{" "}
                          <span className="text-white/30 font-mono">({r.subscription.workspace_id.slice(0, 8)}…)</span>
                        </div>
                        <div className="text-[11px] text-white/40">
                          {r.subscription.plan} · {r.subscription.status}
                          {r.subscription.cancel_at_period_end ? " · cancel at period end" : ""}
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {r.subscription.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-white/35 mt-2">
                      Period:{" "}
                      {r.subscription.current_period_start
                        ? new Date(r.subscription.current_period_start).toLocaleDateString()
                        : "—"}{" "}
                      →{" "}
                      {r.subscription.current_period_end ? new Date(r.subscription.current_period_end).toLocaleDateString() : "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sessions">
          <div className="app-card p-6">
            {sessionsLoading ? (
              <div className="flex items-center justify-center py-10 text-white/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-white/40 text-sm flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4" /> No active sessions found.
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((s, idx) => (
                  <div key={s.id ?? `${idx}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-white/80 truncate">{s.device ?? "Device"}</div>
                        <div className="text-[11px] text-white/40">
                          IP: <span className="font-mono">{s.ip ?? "—"}</span> · Last active:{" "}
                          {new Date(s.updated_at).toLocaleString()}
                        </div>
                      </div>
                      <Badge variant="outline">{idx === 0 ? "Latest" : "Active"}</Badge>
                    </div>
                    {s.raw_user_agent ? (
                      <div className="mt-2 text-[10px] text-white/35 font-mono break-all">{s.raw_user_agent}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="app-card p-6">
            {activityLoading ? (
              <div className="flex items-center justify-center py-10 text-white/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : activity.length === 0 ? (
              <div className="text-white/40 text-sm flex items-center gap-2">
                <History className="h-4 w-4" /> No activity logs found.
              </div>
            ) : (
              <div className="space-y-3">
                {activity.map((l) => (
                  <div key={l.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-white/80 truncate">{l.action_type}</div>
                        <div className="text-[11px] text-white/40">
                          {new Date(l.created_at).toLocaleString()}
                          {l.ip_address ? ` · IP: ${l.ip_address}` : ""}
                          {l.device_info ? ` · Device: ${l.device_info}` : ""}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={l.status === "error" ? "border-red-500/30 text-red-300" : "border-emerald-500/30 text-emerald-300"}
                      >
                        {l.status}
                      </Badge>
                    </div>
                    {l.metadata ? (
                      <pre className="mt-2 text-[10px] text-white/40 whitespace-pre-wrap break-words bg-black/20 border border-white/10 rounded p-2 max-h-40 overflow-auto">
                        {JSON.stringify(l.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tickets">
          <div className="app-card p-6">
            {ticketsLoading ? (
              <div className="flex items-center justify-center py-10 text-white/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-white/40 text-sm">No support tickets for this user.</div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-white/80 truncate">
                          {t.subject}{" "}
                          {typeof t.ticket_number === "number" ? (
                            <span className="text-white/30 font-mono">#{t.ticket_number}</span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-white/40">
                          {t.category} · {t.priority} · {t.status} · {new Date(t.created_at).toLocaleString()}
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="h-8">
                        <Link to="/admin/support">Open in Support</Link>
                      </Button>
                    </div>
                    <div className="mt-2 text-[12px] text-white/55 whitespace-pre-wrap">{t.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

