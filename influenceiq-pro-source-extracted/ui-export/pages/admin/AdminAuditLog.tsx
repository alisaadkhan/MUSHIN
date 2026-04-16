import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { Loader2, ScrollText } from "lucide-react";

interface AuditEntry {
    id: string;
    admin_user_id: string;
    action: string;
    target_user_id: string | null;
    details: any;
    created_at: string;
}

export default function AdminAuditLog() {
    const perms = useAdminPermissions();

    const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
        queryKey: ["admin-audit-log"],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke("admin-audit-log");
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            return data.entries || [];
        },
        enabled: perms.canViewAuditLog,
        staleTime: 30_000,
    });

    const actionColor: Record<string, string> = {
        suspend_user: "bg-red-500/20 text-red-300",
        unsuspend_user: "bg-emerald-500/20 text-emerald-300",
        adjust_credits: "bg-amber-500/20 text-amber-300",
        promote_user: "bg-violet-500/20 text-violet-300",
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Audit Log</h1>
                <p className="text-muted-foreground">All admin actions, in chronological order</p>
            </div>

            {isLoading && (
                <div className="text-center py-20 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading audit log…
                </div>
            )}

            {!isLoading && entries.length === 0 && (
                <div className="glass-card rounded-2xl p-12 text-center">
                    <ScrollText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No audit entries yet. Admin actions will appear here.</p>
                </div>
            )}

            <div className="space-y-2">
                {entries.map((e) => (
                    <div key={e.id} className="glass-card/30 rounded-xl px-5 py-3 flex items-start gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${actionColor[e.action] || "bg-background0/20 text-slate-300"}`}>
                                    {e.action.replace(/_/g, " ")}
                                </span>
                                {e.target_user_id && (
                                    <span className="text-xs text-muted-foreground font-mono">→ {e.target_user_id.slice(0, 8)}…</span>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                By {e.admin_user_id.slice(0, 8)}… · {new Date(e.created_at).toLocaleString()}
                            </p>
                            {e.details && Object.keys(e.details).length > 0 && (
                                <pre className="text-[10px] text-muted-foreground mt-1 bg-[#070707]/50 rounded px-2 py-1 overflow-x-auto">
                                    {JSON.stringify(e.details, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
