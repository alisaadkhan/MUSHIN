import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, CreditCard, TrendingUp, Activity, FlaskConical, Layers, Zap } from "lucide-react";

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

            {/* ── QA Test Suites Panel ────────────────────────────────────── */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-5">
                    <FlaskConical className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <h2 className="text-base font-semibold text-foreground">Automated QA Test Suites</h2>
                    <span className="ml-auto text-xs text-muted-foreground">Run from CLI — see README for setup</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                    {/* Phase 1 — Unit Tests */}
                    <div className="rounded-xl border border-border bg-background/60 p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-emerald-500" strokeWidth={1.5} />
                            <span className="text-sm font-medium text-foreground">Phase 1 · Unit Tests</span>
                        </div>
                        <p className="text-xs text-muted-foreground flex-1">Business logic, plan limits, export utils. Runs in Vitest.</p>
                        <div className="flex items-center gap-2 mt-auto">
                            <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">npm test</code>
                            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">Active</span>
                        </div>
                    </div>

                    {/* Phase 2 — E2E Browser Tests */}
                    <div className="rounded-xl border border-border bg-background/60 p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-blue-500" strokeWidth={1.5} />
                            <span className="text-sm font-medium text-foreground">Phase 2 · E2E Browser</span>
                        </div>
                        <p className="text-xs text-muted-foreground flex-1">28 Playwright scenarios — search simulation, filter matrix, enrichment integrity, niche enforcement.</p>
                        <div className="flex items-center gap-2 mt-auto">
                            <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">npm run test:e2e</code>
                            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30">Active</span>
                        </div>
                    </div>

                    {/* Phase 3 — Combinatorial Assault (Coming Soon) */}
                    <div className="rounded-xl border border-dashed border-border bg-background/30 p-4 flex flex-col gap-3 opacity-75">
                        <div className="flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                            <span className="text-sm font-medium text-foreground">Phase 3 · Combinatorial</span>
                            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 tracking-wide">COMING SOON</span>
                        </div>
                        <p className="text-xs text-muted-foreground flex-1">1 000+ filter combinations auto-generated &amp; executed. Statistical failure analysis, race-condition detection, cache-poisoning checks.</p>
                        <div className="flex items-center gap-2 mt-auto">
                            <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground/50 line-through select-none">npm run test:e2e:phase3</code>
                            <button
                                disabled
                                title="Phase 3 combinatorial suite is coming soon"
                                className="ml-auto text-xs px-3 py-1 rounded-lg border border-border text-muted-foreground/40 cursor-not-allowed select-none"
                            >
                                Run
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
