import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeAuthed } from "@/lib/edge";
import { Loader2, RefreshCw, ShieldAlert, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Row = {
  id: string;
  support_user_id: string;
  target_user_id: string;
  reason: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  computed_status?: "active" | "expired" | "revoked";
  duration_seconds?: number;
  action_count?: number;
  actions_summary?: Array<{ action_type: string; count: number }>;
};

function statusOf(r: Row) {
  if (r.computed_status) return r.computed_status;
  if (r.revoked_at) return "revoked";
  if (new Date(r.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}

export default function AdminImpersonation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<"active" | "all">("active");
  const [reason, setReason] = useState("");
  const [extendReason, setExtendReason] = useState("");
  const [extendMinutes, setExtendMinutes] = useState(15);

  const { data: sessions = [], isLoading, refetch } = useQuery<Row[]>({
    queryKey: ["admin-impersonation", view],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ sessions: Row[] }>("admin-impersonation-control", {
        body: { action: "list", status: view, limit: 300 },
      } as any);
      if (error) throw error;
      return (data as any)?.sessions ?? [];
    },
    staleTime: 10_000,
  });

  const active = useMemo(() => sessions.filter((s) => statusOf(s) === "active"), [sessions]);
  const history = useMemo(() => sessions.filter((s) => statusOf(s) !== "active"), [sessions]);

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await invokeEdgeAuthed("admin-impersonation-control", {
        body: { action: "revoke", session_id: id, reason: reason.trim() },
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setReason("");
      await qc.invalidateQueries({ queryKey: ["admin-impersonation"] });
      toast({ title: "Session revoked" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const extend = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await invokeEdgeAuthed("admin-impersonation-control", {
        body: { action: "extend", session_id: id, minutes: extendMinutes, reason: extendReason.trim() },
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setExtendReason("");
      await qc.invalidateQueries({ queryKey: ["admin-impersonation"] });
      toast({ title: "Extended" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Impersonation</h1>
          <p className="section-subtitle">Active sessions, history, and termination controls (super admin only)</p>
        </div>
        <button className="btn-secondary" onClick={() => refetch()}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2">
        {(["active", "all"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded text-[11px] font-medium capitalize border transition-colors ${
              view === v ? "bg-white/10 text-white border-white/20" : "bg-white/3 text-white/35 border-white/6 hover:bg-white/6"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="app-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-300">
            <ShieldAlert size={14} />
            <h2 className="text-[13px] font-medium">Terminate</h2>
          </div>
          <textarea
            className="input-sharp w-full h-20"
            placeholder="Reason (required, min 10 chars)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="text-[11px] text-white/35">
            Select a session in the table to revoke. Revocation invalidates refresh tokens to end sessions on refresh.
          </div>
        </div>

        <div className="app-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-white/70">
            <Plus size={14} />
            <h2 className="text-[13px] font-medium">Extend</h2>
          </div>
          <input
            type="number"
            min={1}
            max={60}
            value={extendMinutes}
            onChange={(e) => setExtendMinutes(Number(e.target.value))}
            className="input-sharp"
          />
          <textarea
            className="input-sharp w-full h-20"
            placeholder="Reason (required, min 10 chars)…"
            value={extendReason}
            onChange={(e) => setExtendReason(e.target.value)}
          />
          <div className="text-[11px] text-white/35">
            Select a session in the table to extend. Maximum 60 minutes per action.
          </div>
        </div>

        <div className="app-card p-5 space-y-2">
          <h2 className="text-[13px] font-medium">Counts</h2>
          <div className="text-[11px] text-white/35">
            Active: <span className="mono text-white/70">{active.length}</span>
          </div>
          <div className="text-[11px] text-white/35">
            History: <span className="mono text-white/70">{history.length}</span>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                {["Staff", "Target", "Started", "Expires", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-white/25">
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-white/25">
                    No sessions
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const st = statusOf(s);
                  return (
                    <tr key={s.id} className="admin-row align-top">
                      <td className="px-4 py-2.5 mono text-white/30 text-[11px]">{s.support_user_id.slice(0, 8)}…</td>
                      <td className="px-4 py-2.5 mono text-white/30 text-[11px]">{s.target_user_id.slice(0, 8)}…</td>
                      <td className="px-4 py-2.5 text-white/35 text-[11px] whitespace-nowrap">{new Date(s.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-white/35 text-[11px] whitespace-nowrap">{new Date(s.expires_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                            st === "active"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                              : st === "expired"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                : "bg-red-500/10 text-red-300 border-red-500/20"
                          }`}
                        >
                          {st}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            className="btn-secondary"
                            disabled={st !== "active" || revoke.isPending || reason.trim().length < 10}
                            onClick={() => revoke.mutate(s.id)}
                          >
                            {revoke.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={13} />}
                            Terminate
                          </button>
                          <button
                            className="btn-secondary"
                            disabled={st !== "active" || extend.isPending || extendReason.trim().length < 10}
                            onClick={() => extend.mutate(s.id)}
                          >
                            {extend.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={13} />}
                            Extend
                          </button>
                        </div>
                        <div className="text-[10px] text-white/25 mt-2 mono">
                          duration: {Math.floor(Number(s.duration_seconds ?? 0) / 60)}m · actions: {Number(s.action_count ?? 0)}
                        </div>
                        {st !== "active" && (s.actions_summary?.length ?? 0) > 0 ? (
                          <div className="mt-2 text-[10px] text-white/25">
                            <div className="uppercase tracking-widest text-white/20 mb-1">Actions (audit)</div>
                            <div className="space-y-0.5">
                              {s.actions_summary!.slice(0, 8).map((a) => (
                                <div key={a.action_type} className="mono flex items-center justify-between gap-3">
                                  <span className="truncate">{a.action_type}</span>
                                  <span className="text-white/30">{a.count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

