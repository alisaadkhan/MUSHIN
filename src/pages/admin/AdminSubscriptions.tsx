import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invokeEdgeAuthed } from "@/lib/edge";

type Row = {
    subscription: {
        id: string;
        workspace_id: string;
        plan: string;
        status: string;
        stripe_customer_id: string;
        stripe_subscription_id: string | null;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean | null;
        created_at: string;
        updated_at: string;
    };
    workspace: { id: string; name: string; plan: string | null; created_at: string | null; owner_id: string | null } | null;
    owner: { id: string; email: string | null; full_name: string | null; country: string | null } | null;
}

const statusColor: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-300",
    canceled: "bg-red-500/20 text-red-300",
    past_due: "bg-amber-500/20 text-amber-300",
    trialing: "bg-blue-500/20 text-blue-300",
};

export default function AdminSubscriptions() {
    const perms = useAdminPermissions();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [actionId, setActionId] = useState<string | null>(null);
    const [q, setQ] = useState("");

    const { data: rows = [], isLoading, refetch } = useQuery<Row[]>({
        queryKey: ["admin-subscriptions"],
        queryFn: async () => {
            const { data, error } = await invokeEdgeAuthed<{ rows: Row[]; error?: string }>("admin-list-subscriptions", {
                method: "GET",
                search: new URLSearchParams({ limit: "500", active_only: "1" }).toString(),
            } as any);
            if (error) throw error;
            if (data?.error) throw new Error(String(data.error));
            return (data?.rows ?? []) as Row[];
        },
        staleTime: 30_000,
    });

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return rows;
        return rows.filter((r) => {
            const ws = r.workspace?.name ?? "";
            const wsId = r.subscription.workspace_id ?? "";
            const email = r.owner?.email ?? "";
            const name = r.owner?.full_name ?? "";
            const country = r.owner?.country ?? "";
            const plan = r.subscription.plan ?? "";
            const status = r.subscription.status ?? "";
            return [ws, wsId, email, name, country, plan, status].some((s) => s.toLowerCase().includes(needle));
        });
    }, [rows, q]);

    const handleRetry = async (subId: string) => {
        setActionId(subId);
        try {
            toast({ title: "Retry payment initiated", description: "This may take a few seconds." });
        } catch (err: any) {
            toast({ title: "Failed", description: err.message, variant: "destructive" });
        } finally {
            setActionId(null);
            queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Subscriptions</h1>
                <p className="text-muted-foreground">All workspace subscription records (enriched)</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-80">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search by email, workspace, country, plan…"
                        className="h-9 w-full pl-9 pr-3 rounded-lg bg-[#070707] border border-border text-sm text-foreground focus:outline-none focus:border-violet-500"
                    />
                </div>
                <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            {["Owner", "Workspace", "Plan", "Status", "Period", "Cancel", ""].map((h) => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {isLoading && (
                            <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading…
                            </td></tr>
                        )}
                        {filtered.map((r) => {
                            const s = r.subscription;
                            return (
                            <tr key={s.id} className="hover:bg-muted/30/40 align-top">
                                <td className="px-4 py-3">
                                    <div className="text-xs text-slate-200 truncate max-w-[220px]">
                                        {r.owner?.email ?? "—"}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {r.owner?.country ? `Country: ${r.owner.country}` : "Country: —"}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-xs text-slate-200 truncate max-w-[220px]">
                                        {r.workspace?.name ?? "—"}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                        {s.workspace_id.slice(0, 8)}…
                                    </div>
                                </td>
                                <td className="px-4 py-3 capitalize text-slate-200">{s.plan}</td>
                                <td className="px-4 py-3">
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[s.status] || "bg-background0/20 text-slate-300"}`}>
                                        {s.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                    <div>{s.current_period_start ? new Date(s.current_period_start).toLocaleDateString() : "—"} → {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</div>
                                    <div className="text-[10px] text-muted-foreground/80">created {new Date(s.created_at).toLocaleDateString()}</div>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                    {s.cancel_at_period_end ? "Yes" : "No"}
                                </td>
                                <td className="px-4 py-3">
                                    {perms.canRetryPayments && s.status === "past_due" && (
                                        <Button size="sm" variant="ghost"
                                            className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                            disabled={actionId === s.id}
                                            onClick={() => handleRetry(s.id)}
                                        >
                                            {actionId === s.id
                                                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                : <RefreshCw className="h-3 w-3 mr-1" />}
                                            Retry
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
                {!isLoading && filtered.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">No subscriptions found.</div>
                )}
            </div>
        </div>
    );
}
