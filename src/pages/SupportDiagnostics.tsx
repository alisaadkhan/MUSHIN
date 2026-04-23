import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { invokeEdgeAuthed } from "@/lib/edge";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { useSupportPermissions } from "@/hooks/useSupportPermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ActivityRow = {
  id: string;
  created_at: string;
  action_type: string;
  status: string;
  ip_address: string | null;
  device_info: string | null;
  metadata: any;
};

export default function SupportDiagnostics() {
  const { data: perms } = useSupportPermissions();
  const [targetUserId, setTargetUserId] = useState("");
  const [filter, setFilter] = useState("");

  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["support-diagnostics", targetUserId],
    enabled: Boolean(perms?.canViewActivityLogs && targetUserId.trim().length > 0),
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed("support-diagnostics", {
        body: { target_user_id: targetUserId.trim(), limit: 250 },
      } as any);
      if (error) throw error;
      return data as any;
    },
    staleTime: 10_000,
    retry: 1,
  });

  const failures: ActivityRow[] = (data as any)?.api_failures ?? [];
  const timeline: ActivityRow[] = (data as any)?.activity_timeline ?? [];
  const creditUsage: Array<{ day: string; types: Record<string, number> }> = (data as any)?.credit_usage ?? [];
  const aiUsage: Record<string, number> = (data as any)?.ai_usage ?? {};

  const filteredFailures = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return failures;
    return failures.filter((r) => JSON.stringify(r).toLowerCase().includes(needle));
  }, [failures, filter]);

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      <header className="border-b border-white/[0.06] px-6 py-3 flex items-center justify-between sticky top-0 z-50 bg-[#060608]/90 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-teal-400 font-medium uppercase tracking-wider">Support</span>
          <span className="text-white/20">/</span>
          <span className="text-sm font-semibold">Diagnostics</span>
        </div>
        <button onClick={() => refetch()} className="btn-secondary">
          <RefreshCw size={13} />
          Refresh
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Support Diagnostics</h1>
          <p className="text-white/40 text-sm mt-1">Read-only observability with redaction. No secrets returned.</p>
        </div>

        {!perms?.canViewActivityLogs ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-white/40 text-sm">
            Your tier can’t view diagnostics.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                className="input-sharp mono w-[420px]"
                placeholder="Target user id (uuid)…"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
              />
              <div className="relative w-72">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input className="input-sharp pl-8" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
            </div>

            <div className="app-card p-4">
              <Tabs defaultValue="failures">
                <TabsList className="bg-white/5">
                  <TabsTrigger value="failures">API Failures</TabsTrigger>
                  <TabsTrigger value="timeline">Activity</TabsTrigger>
                  <TabsTrigger value="credits">Credit usage</TabsTrigger>
                  <TabsTrigger value="ai">AI usage</TabsTrigger>
                </TabsList>

                <TabsContent value="failures" className="mt-4">
                  {isLoading ? (
                    <div className="py-12 text-center text-white/25">
                      <Loader2 size={16} className="animate-spin mx-auto" />
                    </div>
                  ) : error ? (
                    <div className="text-red-200/80 text-sm">{(error as any)?.message ?? "Failed"}</div>
                  ) : filteredFailures.length === 0 ? (
                    <div className="text-white/40 text-sm">No failures.</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFailures.slice(0, 80).map((r) => (
                        <div key={r.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="mono text-[11px] text-white/65 truncate">{r.action_type}</div>
                              <div className="text-[11px] text-white/35 mt-1">
                                {r.status} · {new Date(r.created_at).toLocaleString()} {r.ip_address ? `· IP ${r.ip_address}` : ""}
                              </div>
                            </div>
                          </div>
                          <pre className="mono text-[10px] text-white/25 whitespace-pre-wrap break-all mt-2">
                            {JSON.stringify(r.metadata ?? {}, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="timeline" className="mt-4">
                  {isLoading ? (
                    <div className="py-12 text-center text-white/25">
                      <Loader2 size={16} className="animate-spin mx-auto" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(timeline ?? []).slice(0, 50).map((r) => (
                        <div key={r.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between">
                            <div className="mono text-[11px] text-white/65">{r.action_type}</div>
                            <div className="text-[11px] text-white/35 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</div>
                          </div>
                          <div className="text-[11px] text-white/35 mt-1">{r.status}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="credits" className="mt-4">
                  {creditUsage.length === 0 ? (
                    <div className="text-white/40 text-sm">No credit data available.</div>
                  ) : (
                    <div className="space-y-2">
                      {creditUsage.map((d) => (
                        <div key={d.day} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                          <div className="text-[11px] text-white/35 mono">{d.day}</div>
                          <div className="text-[11px] text-white/60 mt-1 mono">
                            {Object.entries(d.types).map(([k, v]) => `${k}:${v}`).join(" · ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ai" className="mt-4">
                  {Object.keys(aiUsage).length === 0 ? (
                    <div className="text-white/40 text-sm">No AI usage observed in activity logs.</div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(aiUsage)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 50)
                        .map(([k, v]) => (
                          <div key={k} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 flex items-center justify-between">
                            <div className="mono text-[11px] text-white/65">{k}</div>
                            <div className="mono text-[11px] text-white/35">{v}</div>
                          </div>
                        ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

