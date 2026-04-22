import { Navigate, useLocation } from "react-router-dom";
import { useAdminPermissions, AdminPermissions } from "@/hooks/useAdminPermissions";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminRouteProps {
    children: React.ReactNode;
    requiredPermission?: keyof Omit<AdminPermissions, "role" | "isLoading">;
}

const ADMIN_INACTIVITY_MS = 2 * 60 * 1000; // 2 minutes
const ADMIN_MAX_SESSION_MS = 10 * 60 * 1000; // 10 minutes (force global sign-out)

function readTs(key: string): number | null {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}

function writeNow(key: string) {
    try {
        sessionStorage.setItem(key, String(Date.now()));
    } catch {
        // ignore
    }
}

export function AdminRoute({ children, requiredPermission }: AdminRouteProps) {
    const { user, loading: authLoading } = useAuth();
    const perms = useAdminPermissions();
    const location = useLocation();
    const [locked, setLocked] = useState(false);

    const authAt = useMemo(() => readTs("admin_auth_at"), [user?.id]);
    const lastActivity = useMemo(() => readTs("admin_last_activity"), [user?.id]);

    // Admin-only "re-auth" policy MUST be registered unconditionally (hooks rule).
    // All runtime gating happens inside the effect body.
    useEffect(() => {
        if (!user || !perms.isAnyAdmin) return;

        // If user never logged in via admin portal this session, require going through /admin/login once.
        if (!authAt) {
            setLocked(true);
            return;
        }

        let rafPending = false;
        const bump = () => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                writeNow("admin_last_activity");
            });
        };

        const events: Array<keyof DocumentEventMap> = [
            "mousemove",
            "mousedown",
            "keydown",
            "scroll",
            "touchstart",
            "wheel",
        ];
        for (const ev of events) document.addEventListener(ev, bump, { passive: true });

        const timer = window.setInterval(async () => {
            const now = Date.now();
            const a = readTs("admin_auth_at");
            const la = readTs("admin_last_activity") ?? a;

            // Hard limit: global sign-out (every device)
            if (a && now - a > ADMIN_MAX_SESSION_MS) {
                setLocked(true);
                try {
                    await supabase.auth.signOut({ scope: "global" });
                } finally {
                    try {
                        sessionStorage.removeItem("admin_auth_at");
                        sessionStorage.removeItem("admin_last_activity");
                    } catch { /* ignore */ }
                }
                return;
            }

            // Inactivity: local lock
            if (la && now - la > ADMIN_INACTIVITY_MS) {
                setLocked(true);
                try {
                    await supabase.auth.signOut();
                } finally {
                    try {
                        sessionStorage.removeItem("admin_auth_at");
                        sessionStorage.removeItem("admin_last_activity");
                    } catch { /* ignore */ }
                }
                return;
            }
        }, 2000);

        // Always bump on route change inside admin (counts as activity).
        bump();

        return () => {
            window.clearInterval(timer);
            for (const ev of events) document.removeEventListener(ev, bump);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, perms.isAnyAdmin, authAt, location.pathname]);

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

    if (locked) {
        return <Navigate to="/admin/login" replace />;
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
