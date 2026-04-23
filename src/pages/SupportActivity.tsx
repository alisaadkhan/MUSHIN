import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invokeEdgeAuthed } from "@/lib/edge";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { useSupportPermissions } from "@/hooks/useSupportPermissions";

type Row = {
  id: string;
  timestamp: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action_type: string;
  action_description: string;
  ip_address: string | null;
};

export default function SupportActivity() {
  const { data: perms } = useSupportPermissions();
  const [q, setQ] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [actionType, setActionType] = useState("");
  const [staffId, setStaffId] = useState("");

  const { data = [], isLoading, refetch, error } = useQuery<Row[]>({
    queryKey: ["support-activity", start, end, actionType, staffId],
    enabled: Boolean(perms?.canViewActivityLogs),
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ rows: Row[] }>("support-activity", {
        body: {
          start: start || undefined,
          end: end || undefined,
          action_type: actionType || undefined,
          staff_id: staffId || undefined,
          limit: 300,
        },
      } as any);
      if (error) throw error;
      return ((data as any)?.rows ?? []) as Row[];
    },
    staleTime: 10_000,
    retry: 1,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((r) =>
      [
        r.action_type,
        r.action_description,
        r.actor_user_id ?? "",
        r.target_user_id ?? "",
        r.ip_address ?? "",
        r.timestamp,
      ].some((s) => s.toLowerCase().includes(needle))
    );
  }, [data, q]);

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      <header className="border-b border-white/[0.06] px-6 py-3 flex items-center justify-between sticky top-0 z-50 bg-[#060608]/90 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-teal-400 font-medium uppercase tracking-wider">Support</span>
          <span className="text-white/20">/</span>
          <span className="text-sm font-semibold">Activity</span>
        </div>
        <button onClick={() => refetch()} className="btn-secondary">
          <RefreshCw size={13} />
          Refresh
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Support Activity</h1>
          <p className="text-white/40 text-sm mt-1">Support actions recorded in system audit logs (support:* only).</p>
        </div>

        {!perms?.canViewActivityLogs ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-white/40 text-sm">
            Your tier can’t view activity logs.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-72">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input className="input-sharp pl-8" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <input
                className="input-sharp"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                title="Start"
              />
              <input
                className="input-sharp"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                title="End"
              />
              <input
                className="input-sharp mono w-64"
                placeholder="Action type prefix (e.g. support:support_tickets)"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
              />
              <input
                className="input-sharp mono w-64"
                placeholder="Staff user id (optional)"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
              />
            </div>

            <div className="app-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-border bg-white/[0.02]">
                      {["Time", "Action", "Target user", "Staff", "IP"].map((h) => (
                        <th key={h} className="text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider px-4 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-white/25">
                          <Loader2 size={16} className="animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-red-200/80">
                          {(error as any)?.message ?? "Failed to load activity"}
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-white/25">
                          No rows
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r) => (
                        <tr key={r.id} className="admin-row align-top">
                          <td className="px-4 py-2.5 text-white/35 text-[11px] whitespace-nowrap">
                            {new Date(r.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="mono text-[11px] text-white/65">{r.action_type}</div>
                            <div className="text-[11px] text-white/35 mt-1">{r.action_description}</div>
                          </td>
                          <td className="px-4 py-2.5 mono text-white/30 text-[11px]">
                            {r.target_user_id ? `${r.target_user_id.slice(0, 8)}…` : "—"}
                          </td>
                          <td className="px-4 py-2.5 mono text-white/30 text-[11px]">
                            {r.actor_user_id ? `${r.actor_user_id.slice(0, 8)}…` : "—"}
                          </td>
                          <td className="px-4 py-2.5 mono text-white/25 text-[11px]">{r.ip_address ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

