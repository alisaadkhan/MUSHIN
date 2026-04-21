import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AdminRole = "super_admin" | "admin" | "support" | "viewer" | "user" | null;

export interface AdminPermissions {
    role: AdminRole;
    isLoading: boolean;
    // Role flags
    isSuperAdmin: boolean;
    isAdmin: boolean;
    isSupport: boolean;
    isViewer: boolean;
    isAnyAdmin: boolean;
    // Action permissions
    canManageUsers: boolean;
    canSuspendUser: boolean;
    canImpersonate: boolean;
    canAdjustCredits: boolean;
    canPromoteUsers: boolean;
    canPromoteToSuperAdmin: boolean;
    canRetryPayments: boolean;
    canModerateContent: boolean;
    canEditBlacklist: boolean;
    canEditConfig: boolean;
    canViewAuditLog: boolean;
    canManageAnnouncements: boolean;
}

export function useAdminPermissions(): AdminPermissions {
    const { user } = useAuth();

    const { data: role, isLoading } = useQuery<AdminRole>({
        queryKey: ["admin-role", user?.id],
        queryFn: async () => {
            if (!user) return null;
            const { data, error } = await supabase.rpc("get_my_role");
            if (error) return null;
            return (String(data) as AdminRole) ?? "user";
        },
        enabled: !!user,
        staleTime: 60_000,
    });

    const isSuperAdmin = role === "super_admin";
    const isAdmin = role === "admin" || isSuperAdmin;
    const isSupport = role === "support" || isAdmin;
    const isViewer = role === "viewer" || isSupport;
    const isAnyAdmin = isSuperAdmin || role === "admin" || role === "support" || role === "viewer";

    return {
        role: role ?? null,
        isLoading,
        isSuperAdmin,
        isAdmin,
        isSupport,
        isViewer,
        isAnyAdmin,
        canManageUsers: isSupport,
        canSuspendUser: isAdmin,
        canImpersonate: isSuperAdmin,
        canAdjustCredits: isAdmin,
        canPromoteUsers: isAdmin,
        canPromoteToSuperAdmin: isSuperAdmin,
        canRetryPayments: isAdmin,
        canModerateContent: isAdmin,
        canEditBlacklist: isAdmin,
        canEditConfig: isSuperAdmin,
        canViewAuditLog: isSupport,
        canManageAnnouncements: isAdmin,
    };
}
