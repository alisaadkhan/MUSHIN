import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invokeEdgeAuthed } from "@/lib/edge";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type Status = {
  active: boolean;
  expires_at: string;
};

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function ImpersonationBanner() {
  const { session, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const sessionId = qs.get("impersonation_session_id");

  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!session?.access_token || !sessionId) return;
    let mounted = true;
    const tick = async () => {
      const { data, error } = await invokeEdgeAuthed("impersonation-status", {
        body: { impersonation_session_id: sessionId },
      } as any);
      if (!mounted) return;
      if (error) {
        setStatus(null);
        return;
      }
      const next = { active: Boolean((data as any)?.active), expires_at: String((data as any)?.expires_at ?? "") };
      setStatus(next);
      // If server says it's no longer active (expired/revoked), terminate immediately.
      if (!next.active) {
        await signOut();
        navigate("/support/login", { replace: true });
      }
    };

    void tick();
    const i = window.setInterval(() => void tick(), 15_000);
    return () => {
      mounted = false;
      window.clearInterval(i);
    };
  }, [session?.access_token, sessionId, signOut, navigate]);

  useEffect(() => {
    if (!status?.active) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [status?.active]);

  if (!sessionId || !status?.active) return null;
  const expMs = new Date(status.expires_at).getTime() - now;

  return (
    <div className="border-b border-red-500/20 bg-red-500/[0.06] px-4 py-2 flex items-center justify-between gap-3">
      <div className="text-[12px] text-red-200/90">
        <span className="font-semibold">Impersonation active</span>
        <span className="text-red-200/70"> · expires in </span>
        <span className="mono">{msToClock(expMs)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/15"
          onClick={async () => {
            // Exit = sign out of impersonated session and return to support login.
            await signOut();
            navigate("/support/login", { replace: true });
          }}
        >
          Exit
        </Button>
      </div>
    </div>
  );
}

