import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeAuthed } from "@/lib/edge";
import { AlertTriangle, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type FlagRow = {
  id: string;
  flagged_at: string;
  actor_id: string | null;
  flag_type: string;
  severity: number;
  status?: "open" | "reviewed";
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  reviewed_reason?: string | null;
  summary: string;
  evidence: any;
};

function sevStyle(n: number) {
  if (n >= 5) return "bg-red-500/15 text-red-300 border-red-500/25";
  if (n >= 4) return "bg-red-500/8 text-red-400 border-red-500/15";
  if (n >= 3) return "bg-amber-500/8 text-amber-400 border-amber-500/15";
  return "bg-white/4 text-white/40 border-white/8";
}

export default function AdminSecurityFlags() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [windowMinutes, setWindowMinutes] = useState(10);
  const [deleteThreshold, setDeleteThreshold] = useState(25);
  const [reviewReason, setReviewReason] = useState("");

  const { data: flags = [], isLoading, refetch } = useQuery<FlagRow[]>({
    queryKey: ["superadmin-security-flags"],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ flags: FlagRow[] }>("superadmin-security-flags", {
        body: { action: "list_flags", limit: 200 },
      } as any);
      if (error) throw error;
      return (data as any)?.flags ?? [];
    },
    staleTime: 10_000,
  });

  const markReviewed = useMutation({
    mutationFn: async (flagId: string) => {
      const { data, error } = await invokeEdgeAuthed("update-security-flag-status", {
        body: { flag_id: flagId, status: "reviewed", reason: reviewReason.trim() },
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setReviewReason("");
      await qc.invalidateQueries({ queryKey: ["superadmin-security-flags"] });
      toast({ title: "Marked reviewed" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const runDetection = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeEdgeAuthed("superadmin-security-flags", {
        body: { action: "run_detection", window_minutes: windowMinutes, delete_threshold: deleteThreshold },
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["superadmin-security-flags"] });
      toast({ title: "Detection run complete" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return flags;
    return flags.filter((f) =>
      [f.flag_type, f.summary, f.actor_id ?? "", JSON.stringify(f.evidence ?? {})].some((s) => s.toLowerCase().includes(needle))
    );
  }, [flags, q]);

  const severityLabel = (n: number) => (n >= 4 ? "high" : n >= 3 ? "medium" : "low");

  return (
    <div className="p-8 space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Security Flags</h1>
          <p className="section-subtitle">Suspicious activity detection (super admin only)</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => refetch()}>
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="app-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-white/70">
            <ShieldAlert size={14} />
            <h2 className="text-[13px] font-medium">Run detection</h2>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-white/45">
              Window (minutes)
              <input
                className="input-sharp mt-1"
                type="number"
                value={windowMinutes}
                onChange={(e) => setWindowMinutes(Number(e.target.value))}
                min={1}
                max={1440}
              />
            </label>
            <label className="text-[11px] text-white/45">
              Delete threshold
              <input
                className="input-sharp mt-1"
                type="number"
                value={deleteThreshold}
                onChange={(e) => setDeleteThreshold(Number(e.target.value))}
                min={1}
                max={2000}
              />
            </label>
            <button className="btn-secondary w-full justify-center" disabled={runDetection.isPending} onClick={() => runDetection.mutate()}>
              {runDetection.isPending ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
              Run
            </button>
          </div>
        </div>

        <div className="app-card overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Flags</h2>
            <input className="input-sharp w-72" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="p-4 border-b border-border bg-white/[0.01] flex items-center gap-2 flex-wrap">
            <input
              className="input-sharp w-[420px]"
              placeholder="Review reason (required to mark reviewed)…"
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value)}
            />
            <div className="text-[11px] text-white/30">
              Deep link: open audit log filtered by `support:*` or related actor/target IDs.
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-white/[0.02]">
                  {["Time", "Severity", "Status", "Type", "Actor", "Summary", ""].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-white/25">
                      <Loader2 size={16} className="animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-white/25">
                      No flags
                    </td>
                  </tr>
                ) : (
                  filtered.map((f) => (
                    <tr key={f.id} className="admin-row align-top">
                      <td className="px-4 py-2.5 text-white/35 text-[11px] whitespace-nowrap">
                        {new Date(f.flagged_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${sevStyle(f.severity)}`}>
                          {severityLabel(f.severity)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                            (f.status ?? "open") === "reviewed"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                              : "bg-white/4 text-white/40 border-white/8"
                          }`}
                        >
                          {f.status ?? "open"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 mono text-white/60 text-[11px]">{f.flag_type}</td>
                      <td className="px-4 py-2.5 mono text-white/30 text-[11px]">
                        {f.actor_id ? `${f.actor_id.slice(0, 8)}…` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-white/55">
                        <div className="text-[12px]">{f.summary}</div>
                        <pre className="mono text-[10px] text-white/25 whitespace-pre-wrap break-all mt-2 max-w-[520px]">
                          {JSON.stringify(f.evidence ?? {}, null, 2)}
                        </pre>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            className="btn-secondary"
                            disabled={(f.status ?? "open") === "reviewed" || markReviewed.isPending || reviewReason.trim().length < 10}
                            onClick={() => markReviewed.mutate(f.id)}
                          >
                            {markReviewed.isPending ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={13} />}
                            Mark reviewed
                          </button>
                          <a className="btn-secondary" href={`/admin/audit-log?search=${encodeURIComponent(f.actor_id ?? "")}`} target="_blank" rel="noreferrer">
                            Audit →
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

