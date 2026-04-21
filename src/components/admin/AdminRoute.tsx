import { Navigate } from "react-router-dom";
import { useAdminPermissions, AdminPermissions } from "@/hooks/useAdminPermissions";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";

interface AdminRouteProps {
    children: React.ReactNode;
    requiredPermission?: keyof Omit<AdminPermissions, "role" | "isLoading">;
}

export function AdminRoute({ children, requiredPermission }: AdminRouteProps) {
    const { user, loading: authLoading } = useAuth();
    const perms = useAdminPermissions();

    if (authLoading || perms.isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#070707]">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                    <p className="text-muted-foreground text-sm">Checking permissions…</p>
                </div>
            </div>
        );
    }

    // No active session → force staff login so edge functions get a real JWT.
    if (!user) {
        return <Navigate to="/admin/login" replace />;
    }

    if (!perms.isAnyAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    if (requiredPermission && !perms[requiredPermission]) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center py-32 text-center">
                    <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <span className="text-3xl">🔒</span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
                    <p className="text-muted-foreground max-w-md">
                        You don't have the required permissions to access this page.
                        Contact a Super Admin to request access.
                    </p>
                </div>
            </AdminLayout>
        );
    }

    return <AdminLayout>{children}</AdminLayout>;
}
