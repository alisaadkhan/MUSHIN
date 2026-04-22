import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";

/**
 * SupportRoute — allows access only if the authenticated user holds
 * a staff system role ('support', 'admin', 'super_admin', 'system_admin').
 * Unauthenticated users are sent to /support/login.
 * Authenticated users without the required role are sent to /dashboard.
 */
export function SupportRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const perms = useAdminPermissions();

  if (loading || perms.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070707]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-muted-foreground text-sm">Checking permissions…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/support/login" replace />;
  }

  const role = perms.role ?? "";
  const hasAccess = ["support", "admin", "super_admin", "system_admin"].includes(role);

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
