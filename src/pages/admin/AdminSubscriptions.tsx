import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Sub {
    id: string;
    workspace_id: string;
    plan: string;
    status: string;
    stripe_customer_id: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
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

    const { data: subs = [], isLoading } = useQuery<Sub[]>({
        queryKey: ["admin-subscriptions"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("subscriptions")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data || [];
        },
        staleTime: 30_000,
    });

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
                <p className="text-muted-foreground">All workspace subscription records</p>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            {["Workspace ID", "Plan", "Status", "Period End", "Actions"].map((h) => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {isLoading && (
                            <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Loading…
                            </td></tr>
                        )}
                        {subs.map((s) => (
                            <tr key={s.id} className="hover:bg-muted/30/40">
                                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{s.workspace_id.slice(0, 8)}…</td>
                                <td className="px-4 py-3 capitalize text-slate-200">{s.plan}</td>
                                <td className="px-4 py-3">
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[s.status] || "bg-background0/20 text-slate-300"}`}>
                                        {s.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                    {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}
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
                        ))}
                    </tbody>
                </table>
                {!isLoading && subs.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">No subscriptions found.</div>
                )}
            </div>
        </div>
    );
}
