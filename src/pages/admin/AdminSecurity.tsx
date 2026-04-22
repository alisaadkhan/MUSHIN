import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, RefreshCw, Loader2, Search } from "lucide-react";

type Severity = "low" | "medium" | "high" | "critical";

type SecurityAlertRow = {
  id: string;
  created_at: string;
  severity: Severity;
  category: string;
  user_id: string | null;
  workspace_id: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
};

const SEVERITY_STYLES: Record<Severity, string> = {
  low: "bg-white/4 text-white/40 border-white/8",
  medium: "bg-amber-500/8 text-amber-400 border-amber-500/15",
  high: "bg-red-500/8 text-red-400 border-red-500/15",
  critical: "bg-red-500/15 text-red-300 border-red-500/25",
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

export default function AdminSecurity() {
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");

  const { data: alerts = [], isLoading, refetch } = useQuery<SecurityAlertRow[]>({
    queryKey: ["admin-security-alerts"],
    queryFn: async () => {
      let query = supabase
        .from("security_alerts")
        .select("id,created_at,severity,category,user_id,workspace_id,ip_address,metadata")
        .order("created_at", { ascending: false })
        .limit(200);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SecurityAlertRow[];
    },
    staleTime: 10_000,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return alerts.filter((a) => {
      if (severity !== "all" && a.severity !== severity) return false;
      if (!needle) return true;
      return [
        a.category,
        a.severity,
        a.user_id ?? "",
        a.workspace_id ?? "",
        a.ip_address ?? "",
        JSON.stringify(a.metadata ?? {}),
      ].some((s) => s.toLowerCase().includes(needle));
    });
  }, [alerts, q, severity]);

  return (
    <div className="p-8 space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Security Monitoring</h1>
          <p className="section-subtitle">Flags · Rate limits · Abuse signals</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-72">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="search"
            placeholder="Filter alerts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input-sharp pl-8"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "low", "medium", "high", "critical"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`px-3 py-1.5 rounded text-[11px] font-medium capitalize border transition-colors ${
                severity === s
                  ? "bg-white/10 text-white border-white/20"
                  : "bg-white/3 text-white/35 border-white/6 hover:bg-white/6"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="app-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-[13px] font-medium">Security Alerts</h2>
              <div className="flex items-center gap-1.5">
                {(["all", "low", "medium", "high", "critical"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={`px-2.5 py-1 rounded text-[10px] font-medium capitalize border transition-colors ${
                      severity === s
                        ? "bg-white/10 text-white border-white/20"
                        : "bg-white/3 text-white/35 border-white/6 hover:bg-white/6"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border bg-white/[0.02]">
                    {["Time", "Severity", "Category", "User", "IP", "Metadata"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider px-4 py-3"
                      >
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
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-white/25">
                        <AlertTriangle size={16} className="mx-auto mb-2 opacity-60" />
                        No alerts found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((a) => (
                      <tr key={a.id} className="admin-row align-top">
                        <td className="px-4 py-2.5 mono text-white/25 whitespace-nowrap text-[11px]">
                          {timeAgo(a.created_at)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${SEVERITY_STYLES[a.severity]}`}>
                            {a.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white/60 mono text-[11px]">
                          {a.category}
                        </td>
                        <td className="px-4 py-2.5 mono text-white/30 text-[11px]">
                          {a.user_id ? `${a.user_id.slice(0, 8)}…` : "—"}
                        </td>
                        <td className="px-4 py-2.5 mono text-white/25 text-[11px]">
                          {a.ip_address ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <pre className="mono text-[10px] text-white/25 whitespace-pre-wrap break-all max-w-[400px]">
                            {JSON.stringify(a.metadata ?? {}, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="app-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <RefreshCw size={14} />
              <h2 className="text-[13px] font-medium">Platform Recovery</h2>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Restore critical tables or the entire system state using multi-layered recovery mechanisms.
            </p>
            
            <div className="space-y-2 pt-2">
              <div className="p-3 rounded border border-white/5 bg-white/[0.02] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">Layer 1</span>
                  <span className="text-[10px] text-white/40">Platform PITR</span>
                </div>
                <p className="text-[11px] text-white/60">Restoration managed via Supabase Dashboard.</p>
              </div>

              <div className="p-3 rounded border border-white/5 bg-white/[0.02] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">Layer 2</span>
                  <span className="text-[10px] text-white/40">Targeted Rollback</span>
                </div>
                <p className="text-[11px] text-white/60">Revert specific tables to any point in time.</p>
                <button className="w-full btn-secondary text-[11px] py-1.5 justify-center">
                  Open Rollback Tool
                </button>
              </div>

              <div className="p-3 rounded border border-white/5 bg-white/[0.02] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">Layer 3</span>
                  <span className="text-[10px] text-white/40">System Snapshots</span>
                </div>
                <p className="text-[11px] text-white/60">Restore from logical system-wide restore points.</p>
                <button className="w-full btn-secondary text-[11px] py-1.5 justify-center">
                  Manage Snapshots
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <a 
                href="/RECOVERY_RUNBOOK.md" 
                target="_blank"
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
              >
                View Operational Runbook
              </a>
            </div>
          </div>

          <div className="app-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle size={14} />
              <h2 className="text-[13px] font-medium">Emergency Controls</h2>
            </div>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[11px] font-medium hover:bg-red-500/15 transition-colors">
                Request Secrets Rotation
              </button>
              <button className="w-full px-4 py-2 rounded bg-white/5 text-white/60 border border-white/10 text-[11px] font-medium hover:bg-white/10 transition-colors">
                Terminate All Admin Sessions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

