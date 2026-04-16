import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart2, Search, Users, CreditCard } from "lucide-react";

export default function AdminAnalytics() {
    const { data, isLoading } = useQuery({
        queryKey: ["admin-analytics"],
        queryFn: async () => {
            const [searches, users, subs] = await Promise.all([
                supabase.from("search_history").select("id,created_at", { count: "exact" }),
                supabase.from("profiles").select("id,created_at", { count: "exact" }),
                supabase.from("subscriptions").select("plan,status"),
            ]);
            const planCounts: Record<string, number> = {};
            (subs.data || []).forEach((s) => {
                planCounts[s.plan] = (planCounts[s.plan] || 0) + 1;
            });
            return {
                totalSearches: searches.count ?? 0,
                totalUsers: users.count ?? 0,
                planCounts,
            };
        },
        staleTime: 60_000,
    });

    const stats = [
        { label: "Total Searches", value: data?.totalSearches ?? 0, icon: Search, color: "bg-violet-600" },
        { label: "Total Users", value: data?.totalUsers ?? 0, icon: Users, color: "bg-blue-600" },
        { label: "Pro Subscriptions", value: data?.planCounts?.["pro"] ?? 0, icon: CreditCard, color: "bg-emerald-600" },
        { label: "Business Subscriptions", value: data?.planCounts?.["business"] ?? 0, icon: BarChart2, color: "bg-amber-600" },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Platform Analytics</h1>
                <p className="text-muted-foreground">Key platform usage metrics</p>
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
        </div>
    );
}
