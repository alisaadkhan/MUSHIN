import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserX, UserCheck, DollarSign, Shield, Loader2 } from "lucide-react";

interface UserRow {
    id: string;
    full_name: string | null;
    email?: string;
    role?: string;
    plan?: string;
    created_at: string;
    suspended?: boolean;
}

function RoleBadge({ role }: { role?: string }) {
    const colors: Record<string, string> = {
        super_admin: "bg-violet-500/20 text-violet-300 border-violet-500/30",
        admin: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        support: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        viewer: "bg-background0/20 text-slate-300 border-slate-500/30",
        user: "bg-slate-600/20 text-muted-foreground border-slate-600/30",
    };
    const r = role || "user";
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors[r] || colors.user}`}>
            {r.replace("_", " ")}
        </span>
    );
}

export default function AdminUsers() {
    const perms = useAdminPermissions();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const { data: users = [], isLoading } = useQuery<UserRow[]>({
        queryKey: ["admin-users"],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke("admin-list-users");
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            return data.users || [];
        },
        staleTime: 30_000,
    });

    const filtered = users.filter((u) => {
        const term = search.toLowerCase();
        return !term || u.full_name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
    });

    const callAdmin = async (fn: string, body: object) => {
        const { data, error } = await supabase.functions.invoke(fn, { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    };

    const handleAction = async (action: string, userId: string, extra?: object) => {
        setActionLoading(`${action}-${userId}`);
        try {
            if (action === "suspend") {
                await callAdmin("admin-suspend-user", { target_user_id: userId, suspend: true });
                toast({ title: "User suspended" });
            } else if (action === "unsuspend") {
                await callAdmin("admin-suspend-user", { target_user_id: userId, suspend: false });
                toast({ title: "User reactivated" });
            } else if (action === "adjust") {
                await callAdmin("admin-adjust-credits", { target_user_id: userId, ...extra });
                toast({ title: "Credits adjusted" });
            } else if (action === "promote") {
                await callAdmin("admin-promote-user", { target_user_id: userId, ...extra });
                toast({ title: "Role updated" });
            }
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        } catch (err: any) {
            toast({ title: "Action failed", description: err.message, variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">User Management</h1>
                <p className="text-muted-foreground">View, suspend, and manage all platform users</p>
            </div>

            <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-muted/30 border-border text-slate-200 placeholder:text-muted-foreground focus:border-violet-500"
                />
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Joined</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {isLoading && (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                    Loading users…
                                </td>
                            </tr>
                        )}
                        {!isLoading && filtered.map((u) => (
                            <tr key={u.id} className="hover:bg-muted/30/40 transition-colors">
                                <td className="px-4 py-3">
                                    <div>
                                        <p className="text-slate-200 font-medium">{u.full_name || "—"}</p>
                                        <p className="text-xs text-muted-foreground">{u.email}</p>
                                    </div>
                                </td>
                                <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                                <td className="px-4 py-3">
                                    <span className="text-xs text-slate-300 capitalize">{u.plan || "free"}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1.5">
                                        {perms.canSuspendUser && (
                                            u.suspended ? (
                                                <Button
                                                    size="sm" variant="ghost"
                                                    className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                                    disabled={!!actionLoading}
                                                    onClick={() => handleAction("unsuspend", u.id)}
                                                >
                                                    {actionLoading === `unsuspend-${u.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
                                                    Reactivate
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm" variant="ghost"
                                                    className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    disabled={!!actionLoading}
                                                    onClick={() => handleAction("suspend", u.id)}
                                                >
                                                    {actionLoading === `suspend-${u.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3.5 w-3.5 mr-1" />}
                                                    Suspend
                                                </Button>
                                            )
                                        )}
                                        {perms.canAdjustCredits && (
                                            <Button
                                                size="sm" variant="ghost"
                                                className="h-7 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                                disabled={!!actionLoading}
                                                onClick={() => handleAction("adjust", u.id, { search_credits: 100 })}
                                            >
                                                <DollarSign className="h-3.5 w-3.5 mr-1" /> +100
                                            </Button>
                                        )}
                                        {perms.canPromoteUsers && (
                                            <Button
                                                size="sm" variant="ghost"
                                                className="h-7 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
                                                disabled={!!actionLoading}
                                                onClick={() => handleAction("promote", u.id, { new_role: "admin" })}
                                            >
                                                <Shield className="h-3.5 w-3.5 mr-1" /> Promote
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {!isLoading && filtered.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">No users found.</div>
                )}
            </div>
        </div>
    );
}
