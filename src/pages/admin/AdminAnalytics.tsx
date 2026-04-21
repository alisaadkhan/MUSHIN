import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart2, Search, Users, CreditCard, RefreshCw } from "lucide-react";

type PaddleSub = {
    user_id: string;
    plan_name: string;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
};

export default function AdminAnalytics() {
    const { data, isLoading } = useQuery({
        queryKey: ["admin-analytics"],
        queryFn: async () => {
            const [searches, users, paddleSubs, userList] = await Promise.all([
                supabase.from("search_history").select("id,created_at", { count: "exact" }),
                supabase.from("profiles").select("id,created_at", { count: "exact" }),
                supabase
                    .from("paddle_subscriptions")
                    .select("user_id,plan_name,status,current_period_end,cancel_at_period_end")
                    .order("updated_at", { ascending: false }),
                supabase.functions.invoke("admin-list-users"),
            ]);

            const emailByUser: Record<string, string> = {};
            for (const u of userList.data?.users ?? []) {
                if (u?.id && u?.email) emailByUser[u.id] = u.email;
            }

            const planCounts: Record<string, number> = {};
            (paddleSubs.data || []).forEach((s: any) => {
                const k = s.plan_name || "unknown";
                planCounts[k] = (planCounts[k] || 0) + 1;
            });
            return {
                totalSearches: searches.count ?? 0,
                totalUsers: users.count ?? 0,
                planCounts,
                subscriptions: (paddleSubs.data ?? []).map((s: PaddleSub) => ({
                    ...s,
                    email: emailByUser[s.user_id] ?? null,
                })),
            };
        },
        staleTime: 20_000,
        refetchInterval: 20_000,
    });

    const stats = [
        { label: "Total Searches", value: data?.totalSearches ?? 0, icon: Search, color: "bg-violet-600" },
        { label: "Total Users", value: data?.totalUsers ?? 0, icon: Users, color: "bg-blue-600" },
        { label: "Pro Subscriptions", value: data?.planCounts?.["pro"] ?? 0, icon: CreditCard, color: "bg-emerald-600" },
        { label: "Business Subscriptions", value: data?.planCounts?.["business"] ?? 0, icon: BarChart2, color: "bg-amber-600" },
    ];

    const enterpriseCount = data?.planCounts?.["enterprise"] ?? 0;
    if (enterpriseCount) {
        stats.push({ label: "Enterprise Subscriptions", value: enterpriseCount, icon: BarChart2, color: "bg-purple-600" });
    }

    const subs = (data?.subscriptions ?? []) as Array<PaddleSub & { email: string | null }>;
    const upcoming = useMemo(() => {
        return subs
            .slice()
            .sort((a, b) => (a.current_period_end ?? "").localeCompare(b.current_period_end ?? ""))
            .slice(0, 25);
    }, [subs]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Platform Analytics</h1>
                <p className="text-muted-foreground">Key platform metrics · Real-time (20s)</p>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <div key={s.label} className="glass-card rounded-2xl p-6">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 ${s.color}`}>
                            <s.icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                        </div>
                        <p className="text-3xl font-bold text-foreground mb-1">{isLoading ? "—" : s.value}</p>
                        <p className="text-sm text-muted-foreground">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="glass-card rounded-2xl p-6">
                <h2 className="text-base font-semibold text-foreground mb-4">Plan Distribution</h2>
                {data?.planCounts ? (
                    <div className="space-y-3">
                        {Object.entries(data.planCounts).map(([plan, count]) => (
                            <div key={plan} className="flex items-center gap-3">
                                <span className="text-sm text-slate-300 w-20 capitalize">{plan}</span>
                                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-violet-500 rounded-full"
                                        style={{ width: `${Math.min((count / (data.totalUsers || 1)) * 100, 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">Loading…</p>
                )}
            </div>

            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-foreground">Subscriptions (Paddle)</h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        updating
                    </div>
                </div>

                {isLoading ? (
                    <p className="text-muted-foreground text-sm">Loading…</p>
                ) : upcoming.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No subscriptions found yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                                    <th className="py-2 pr-3">User</th>
                                    <th className="py-2 pr-3">Plan</th>
                                    <th className="py-2 pr-3">Status</th>
                                    <th className="py-2 pr-3">Expires</th>
                                    <th className="py-2 pr-3">Cancel at period end</th>
                                </tr>
                            </thead>
                            <tbody>
                                {upcoming.map((s) => (
                                    <tr key={`${s.user_id}-${s.current_period_end ?? "none"}`} className="border-b border-border/40">
                                        <td className="py-2 pr-3 text-foreground">{s.email ?? `${s.user_id.slice(0, 8)}…`}</td>
                                        <td className="py-2 pr-3 text-foreground capitalize">{s.plan_name}</td>
                                        <td className="py-2 pr-3 text-foreground">{s.status}</td>
                                        <td className="py-2 pr-3 text-foreground">
                                            {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
                                        </td>
                                        <td className="py-2 pr-3 text-foreground">{s.cancel_at_period_end ? "Yes" : "No"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
