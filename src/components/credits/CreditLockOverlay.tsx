import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { useAuth } from "@/contexts/AuthContext";

type CreditSnapshot = {
  search: number;
  ai: number;
  enrichment: number;
  email: number;
  total: number;
};

function toInt(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function CreditLockOverlay() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data, isLoading } = useWorkspaceCredits();

  const credits = useMemo<CreditSnapshot>(() => {
    const search = toInt(data?.search_credits_remaining);
    const ai = toInt(data?.ai_credits_remaining);
    const enrichment = toInt(data?.enrichment_credits_remaining);
    const email = toInt(data?.email_sends_remaining);
    return { search, ai, enrichment, email, total: search + ai + enrichment + email };
  }, [data]);

  // Let users access billing/credits/settings + auth routes even when locked
  const isWhitelistedRoute =
    pathname === "/billing" ||
    pathname === "/credits" ||
    pathname === "/settings" ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/auth" ||
    pathname === "/update-password" ||
    pathname === "/" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/cookies" ||
    pathname === "/about" ||
    pathname === "/blog";

  // "All features disabled" should mean: no usable credits of any kind.
  const locked = !isLoading && credits.total <= 0;

  if (!locked || isWhitelistedRoute) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      {/* Backdrop that blocks all interactions */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-background/90 shadow-2xl">
          <div className="p-6">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center flex-shrink-0">
                <Lock className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">Credits exhausted</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your workspace has no remaining credits. All features are disabled until you upgrade.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Remaining balances
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-background/50 px-3 py-2">
                  <span className="text-muted-foreground">Search</span>
                  <span className="font-semibold text-foreground tabular-nums">{credits.search}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-background/50 px-3 py-2">
                  <span className="text-muted-foreground">AI</span>
                  <span className="font-semibold text-foreground tabular-nums">{credits.ai}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-background/50 px-3 py-2">
                  <span className="text-muted-foreground">Enrichment</span>
                  <span className="font-semibold text-foreground tabular-nums">{credits.enrichment}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-background/50 px-3 py-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-semibold text-foreground tabular-nums">{credits.email}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <Button className="w-full btn-shine" onClick={() => navigate("/billing")}>
                Upgrade now
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/credits")}>
                View credits & history
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => signOut()}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

