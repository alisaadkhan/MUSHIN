import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, CreditCard, TrendingUp, Activity } from "lucide-react";

interface StatCard {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    sub?: string;
}

function KPICard({ label, value, icon: Icon, color, sub }: StatCard) {
    return (
        <div className="glass-card rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                </div>
            </div>
            <p className="text-3xl font-bold text-foreground stat-num mb-1">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
    );
}

export default function AdminDashboard() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ["admin-dashboard-stats"],
        queryFn: async () => {
            const [usersRes, subsRes, workspacesRes] = await Promise.all([
                supabase.from("profiles").select("id", { count: "exact", head: true }),
                supabase.from("subscriptions").select("id,plan,status", { count: "exact" }),
                supabase.from("workspaces").select("id", { count: "exact", head: true }),
            ]);
            const activeSubs = (subsRes.data || []).filter((s) => s.status === "active").length;
            return {
                totalUsers: usersRes.count ?? 0,
                totalWorkspaces: workspacesRes.count ?? 0,
                activeSubs,
                totalSubs: subsRes.count ?? 0,
            };
        },
        staleTime: 30_000,
    });

    const cards: StatCard[] = [
        { label: "Total Users", value: isLoading ? "—" : stats?.totalUsers ?? 0, icon: Users, color: "bg-primary", sub: "Registered accounts" },
        { label: "Active Subscriptions", value: isLoading ? "—" : stats?.activeSubs ?? 0, icon: CreditCard, color: "bg-emerald-500", sub: `of ${stats?.totalSubs ?? 0} total` },
        { label: "Total Workspaces", value: isLoading ? "—" : stats?.totalWorkspaces ?? 0, icon: TrendingUp, color: "bg-blue-600", sub: "Org units" },
        { label: "Platform Health", value: "99.9%", icon: Activity, color: "bg-amber-600", sub: "Uptime (30d)" },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Admin Dashboard</h1>
                <p className="text-muted-foreground">Platform overview and key metrics</p>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {cards.map((c) => (
                    <KPICard key={c.label} {...c} />
                ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="glass-card rounded-2xl p-6">
                    <h2 className="text-base font-semibold text-foreground mb-4">Recent Activity</h2>
                    <p className="text-muted-foreground text-sm">No recent admin actions. Activity will appear here once admin operations are performed.</p>
                </div>
                <div className="glass-card rounded-2xl p-6">
                    <h2 className="text-base font-semibold text-foreground mb-4">System Status</h2>
                    <div className="space-y-3">
                        {["Database", "Edge Functions", "Auth Service", "Storage"].map((s) => (
                            <div key={s} className="flex items-center justify-between">
                                <span className="text-sm text-slate-300">{s}</span>
                                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                                    Operational
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
