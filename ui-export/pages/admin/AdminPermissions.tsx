import { CheckCircle, XCircle } from "lucide-react";

const ROLES = ["super_admin", "admin", "support", "viewer"];
const PERMISSIONS = [
    { label: "View Users", key: "canManageUsers", roles: ["super_admin", "admin", "support"] },
    { label: "Suspend Users", key: "canSuspendUser", roles: ["super_admin", "admin"] },
    { label: "Impersonate", key: "canImpersonate", roles: ["super_admin"] },
    { label: "Adjust Credits", key: "canAdjustCredits", roles: ["super_admin", "admin"] },
    { label: "Promote Users", key: "canPromoteUsers", roles: ["super_admin", "admin"] },
    { label: "Promote → Super Admin", key: "canPromoteToSuperAdmin", roles: ["super_admin"] },
    { label: "Retry Payments", key: "canRetryPayments", roles: ["super_admin", "admin"] },
    { label: "Moderate Content", key: "canModerateContent", roles: ["super_admin", "admin"] },
    { label: "Edit Blacklist", key: "canEditBlacklist", roles: ["super_admin", "admin"] },
    { label: "Edit Config", key: "canEditConfig", roles: ["super_admin"] },
    { label: "View Audit Log", key: "canViewAuditLog", roles: ["super_admin"] },
    { label: "Manage Announcements", key: "canManageAnnouncements", roles: ["super_admin", "admin"] },
    { label: "View Analytics", key: "viewAnalytics", roles: ["super_admin", "admin", "support", "viewer"] },
];

const roleColors: Record<string, string> = {
    super_admin: "text-violet-300",
    admin: "text-blue-300",
    support: "text-emerald-300",
    viewer: "text-slate-300",
};

export default function AdminPermissions() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Permissions Matrix</h1>
                <p className="text-muted-foreground">Role-permission mapping across all admin roles</p>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-56">Permission</th>
                            {ROLES.map((r) => (
                                <th key={r} className={`text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider ${roleColors[r]}`}>
                                    {r.replace("_", " ")}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                        {PERMISSIONS.map((p) => (
                            <tr key={p.key} className="hover:bg-muted/30/40">
                                <td className="px-4 py-3 text-slate-300 text-sm">{p.label}</td>
                                {ROLES.map((r) => (
                                    <td key={r} className="px-4 py-3 text-center">
                                        {p.roles.includes(r)
                                            ? <CheckCircle className="h-4 w-4 text-emerald-400 mx-auto" />
                                            : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                                        }
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="grid grid-cols-4 gap-3">
                {ROLES.map((r) => (
                    <div key={r} className="glass-card rounded-xl p-4">
                        <p className={`text-sm font-semibold mb-1 capitalize ${roleColors[r]}`}>{r.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground">
                            {PERMISSIONS.filter((p) => p.roles.includes(r)).length} permissions
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
