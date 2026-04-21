import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * SupportRoute — allows access only if the authenticated user holds
 * the 'support', 'admin', or 'super_admin' workspace role.
 * Unauthenticated users are sent to /support/login.
 * Authenticated users without the required role are sent to /dashboard.
 */
export function SupportRoute({ children }: { children: ReactNode }) {
  const { user, loading, workspace } = useAuth();

  if (loading) {
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

  const role = workspace?.role ?? "";
  const hasAccess = ["support", "admin", "super_admin"].includes(role);

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
