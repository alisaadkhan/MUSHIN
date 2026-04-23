import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invokeEdgeAuthed } from "@/lib/edge";
import { Loader2, RefreshCw, Search } from "lucide-react";

type Row = {
  id: string;
  timestamp: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  workspace_id: string | null;
  action_type: string;
  action_description: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata_json: any;
};

export default function AdminSupportActivity() {
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");
  const [target, setTarget] = useState("");

  const { data, isLoading, refetch } = useQuery<Row[]>({
    queryKey: ["superadmin-support-activity", actor, target],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ activity: Row[] }>("superadmin-security-flags", {
        body: {
          action: "support_activity",
          limit: 300,
          actor_user_id: actor.trim() || undefined,
          target_user_id: target.trim() || undefined,
        },
      } as any);
      if (error) throw error;
      return (data as any)?.activity ?? [];
    },
    staleTime: 10_000,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = data ?? [];
    if (!needle) return rows;
    return rows.filter((r) =>
      [
        r.action_type,
        r.action_description,
        r.actor_user_id ?? "",
        r.target_user_id ?? "",
        r.workspace_id ?? "",
        r.ip_address ?? "",
        JSON.stringify(r.metadata_json ?? {}),
      ].some((s) => s.toLowerCase().includes(needle))
    );
  }, [data, q]);

  return (
    <div className="p-8 space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Support Oversight</h1>
          <p className="section-subtitle">Support actions from system audit logs (super admin only)</p>
        </div>
        <button className="btn-secondary" onClick={() => refetch()}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-72">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input className="input-sharp pl-8" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <input className="input-sharp w-72 mono" placeholder="Actor user id (optional)" value={actor} onChange={(e) => setActor(e.target.value)} />
        <input className="input-sharp w-72 mono" placeholder="Target user id (optional)" value={target} onChange={(e) => setTarget(e.target.value)} />
      </div>

      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-white/[0.02]">
                {["Time", "Action", "Actor", "Target", "Workspace", "IP", "Meta"].map((h) => (
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
                    No rows
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="admin-row align-top">
                    <td className="px-4 py-2.5 text-white/35 text-[11px] whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 mono text-white/60 text-[11px]">{r.action_type}</td>
                    <td className="px-4 py-2.5 mono text-white/30 text-[11px]">{r.actor_user_id ? `${r.actor_user_id.slice(0, 8)}…` : "—"}</td>
                    <td className="px-4 py-2.5 mono text-white/30 text-[11px]">{r.target_user_id ? `${r.target_user_id.slice(0, 8)}…` : "—"}</td>
                    <td className="px-4 py-2.5 mono text-white/25 text-[11px]">{r.workspace_id ? `${r.workspace_id.slice(0, 8)}…` : "—"}</td>
                    <td className="px-4 py-2.5 mono text-white/25 text-[11px]">{r.ip_address ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <pre className="mono text-[10px] text-white/25 whitespace-pre-wrap break-all max-w-[460px]">
                        {JSON.stringify(r.metadata_json ?? {}, null, 2)}
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
  );
}

