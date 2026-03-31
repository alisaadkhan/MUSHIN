import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, CreditCard, TrendingUp, Activity, AlertTriangle, ShieldAlert, Server } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

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
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const restrictUser = useMutation({
        mutationFn: async (userId: string) => {
            const { error } = await supabase.rpc('restrict_user', { target_user_id: userId, restrict_reason: 'Admin dashboard manual restriction' });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "User Restricted", description: "The user has been successfully restricted." });
            queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
        },
        onError: (error: any) => {
            toast({ title: "Operation Failed", description: error.message, variant: "destructive" });
        }
    });
    const { data: stats, isLoading } = useQuery({
        queryKey: ["admin-dashboard-stats"],
        queryFn: async () => {
            const [usersRes, subsRes, workspacesRes, apiLogsRes, suspiciousRes] = await Promise.all([
                supabase.from("profiles").select("id", { count: "exact", head: true }),
                supabase.from("subscriptions").select("id,plan,status", { count: "exact" }),
                supabase.from("workspaces").select("id", { count: "exact", head: true }),
                // Fetch recent API usage to compute charts and system health
                supabase.from("api_usage_logs" as any).select("timestamp, latency_ms, status_code, endpoint").order('timestamp', { ascending: false }).limit(200),
                // Fetch Suspicious/Restricted Profiles
                supabase.from("profiles").select("id, full_name, email, is_restricted, is_suspicious").or("is_restricted.eq.true,is_suspicious.eq.true").limit(10)
            ]);
            
            const activeSubs = (subsRes.data || []).filter((s) => s.status === "active").length;
            
            // Process API Logs into timeseries for charts (last 20 requests)
            const rawApiLogsData = (apiLogsRes.data as any[]) || [];
            const recentApiLogs = rawApiLogsData.slice(0, 50).reverse();
            let avgLatency = 0;
            if (recentApiLogs.length > 0) {
                avgLatency = recentApiLogs.reduce((acc, val) => acc + (val.latency_ms || 0), 0) / recentApiLogs.length;
            }

            return {
                totalUsers: usersRes.count ?? 0,
                totalWorkspaces: workspacesRes.count ?? 0,
                activeSubs,
                totalSubs: subsRes.count ?? 0,
                apiLogs: recentApiLogs.map((log, index) => ({
                    id: index,
                    latency: log.latency_ms || 0,
                    endpoint: log.endpoint,
                    status: log.status_code || 200,
                    time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                })),
                avgLatency: Math.round(avgLatency),
                suspiciousProfiles: suspiciousRes.data || [],
                rawApiLogs: rawApiLogsData
            };
        },
        staleTime: 10_000, // Refetch more frequently for near real-time analytics
        refetchInterval: 15_000, 
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

                <div className="glass-card rounded-2xl p-6 lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                                <Activity className="h-4 w-4 text-emerald-400" />
                                API Latency Pulse (ms)
                            </h2>
                            <p className="text-muted-foreground text-sm">Real-time asynchronous telemetry pipeline</p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-bold font-mono text-emerald-400">{stats?.avgLatency || 0}</span>
                            <span className="text-xs text-muted-foreground ml-1">avg ms</span>
                        </div>
                    </div>
                    {isLoading || !stats?.apiLogs || stats.apiLogs.length === 0 ? (
                        <div className="h-48 flex items-center justify-center border border-white/5 rounded-xl bg-white/5">
                            <p className="text-muted-foreground text-sm">Awaiting telemetry data...</p>
                        </div>
                    ) : (
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={stats.apiLogs}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                    <XAxis dataKey="time" hide />
                                    <YAxis hide domain={[0, 'dataMax + 100']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                        labelStyle={{ color: '#888', marginBottom: '4px' }}
                                        formatter={(value: number, name: string, props: any) => [
                                            <span key="1" className="font-mono text-emerald-400">{value}ms</span>,
                                            <span key="2" className="text-xs ml-2 text-slate-400">({props.payload.endpoint} - {props.payload.status})</span>
                                        ]}
                                        labelFormatter={(label) => label}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="latency"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        dot={{ r: 2, fill: '#10b981' }}
                                        activeDot={{ r: 4, fill: '#fff' }}
                                        animationDuration={500}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div className="glass-card rounded-2xl p-6">
                    <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Server className="h-4 w-4 text-blue-400" />
                        Recent API Calls
                    </h2>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {(!stats?.rawApiLogs || stats.rawApiLogs.length === 0) ? (
                            <p className="text-muted-foreground text-sm">No recent telemetry recorded.</p>
                        ) : (
                            stats.rawApiLogs.slice(0, 8).map((log: any, idx) => (
                                <div key={idx} className="flex flex-col justify-between py-2 border-b border-border/50 last:border-0">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-slate-200 font-mono truncate max-w-[150px]">{log.endpoint}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${log.status_code >= 400 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                            {log.status_code}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1 text-xs">
                                        <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        <span className="text-slate-400 font-mono">{log.latency_ms}ms</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="glass-card rounded-2xl p-6 border border-red-500/20 bg-gradient-to-b from-red-500/5 to-transparent">
                    <h2 className="text-base font-semibold text-red-400 mb-4 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" />
                        Security & Access Controls
                    </h2>
                    <div className="space-y-3">
                        {(!stats?.suspiciousProfiles || stats.suspiciousProfiles.length === 0) ? (
                            <div className="flex items-center gap-2 text-sm text-emerald-400/80 p-3 bg-emerald-500/10 rounded-lg">
                                <Activity className="h-4 w-4" />
                                <span>No restricted or suspicious users detected.</span>
                            </div>
                        ) : (
                            stats.suspiciousProfiles.map((sp: any) => (
                                <div key={sp.id} className="flex flex-col p-3 border border-red-500/30 bg-red-500/10 rounded-lg gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-200">{sp.full_name || 'Unknown'}</span>
                                        {sp.is_restricted && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 border border-red-500/30">Restricted</span>}
                                        {!sp.is_restricted && sp.is_suspicious && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">Suspicious</span>}
                                    </div>
                                    <span className="text-xs text-slate-400 truncate">{sp.email}</span>
                                    {/* Action button hook for the next admin control task */}
                                    {sp.is_suspicious && !sp.is_restricted && (
                                       <button 
                                            onClick={() => restrictUser.mutate(sp.id)}
                                            disabled={restrictUser.isPending}
                                            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 py-1.5 rounded transition-colors mt-1 font-medium w-full text-center disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {restrictUser.isPending ? "Restricting..." : "Restrict User"}
                                       </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
