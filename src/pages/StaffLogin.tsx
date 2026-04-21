import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Loader2, ShieldAlert, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { MushInLogo } from "@/components/ui/MushInLogo";

type PortalMode = "admin" | "support";

function detectModeFromPath(pathname: string): PortalMode {
  if (pathname.startsWith("/support")) return "support";
  return "admin";
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  right?: React.ReactNode;
}
const StaffInput = ({ icon, right, ...props }: InputProps) => (
  <div className="relative">
    {icon && (
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
        {icon}
      </span>
    )}
    <input
      className={`auth-input ${icon ? "pl-9" : ""} ${right ? "pr-9" : ""}`}
      {...props}
    />
    {right && <span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span>}
  </div>
);

export default function StaffLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = detectModeFromPath(location.pathname);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already authenticated, route based on role
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: roleText, error } = await supabase.rpc("get_my_role");
      if (error || !roleText) return;
      const role = String(roleText);

      if (role === "support") navigate("/support/dashboard", { replace: true });
      else navigate("/admin", { replace: true });
    });
  }, [navigate]);

  const allowedRoles = mode === "support"
    ? ["support", "admin", "super_admin", "system_admin"]
    : ["admin", "super_admin", "system_admin"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication failed.");

      const { data: roleText, error: roleErr } = await supabase.rpc("get_my_role");
      const role = String(roleText ?? "");

      if (roleErr || !allowedRoles.includes(role as any)) {
        await supabase.auth.signOut();
        throw new Error(mode === "support"
          ? "This account does not have support access."
          : "This account does not have admin access."
        );
      }

      if (role === "support") navigate("/support/dashboard");
      else navigate("/admin");
    } catch (err: any) {
      toast({
        title: "Access denied",
        description: err?.message ?? "Invalid credentials.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const accent = mode === "support"
    ? { badge: "Support Staff Portal — Restricted", Icon: Headphones, color: "teal" as const }
    : { badge: "Restricted Access — Admins Only", Icon: ShieldAlert, color: "red" as const };

  const BadgeIcon = accent.Icon;
  const badgeClass = accent.color === "teal"
    ? "border-teal-500/30 bg-teal-500/10 text-teal-300"
    : "border-red-500/20 bg-red-500/5 text-red-300/70";
  const iconWrapClass = accent.color === "teal"
    ? "border-teal-500/30 bg-teal-500/10"
    : "border-red-500/20 bg-red-500/8";
  const iconClass = accent.color === "teal" ? "text-teal-400" : "text-red-400";
  const buttonClass = accent.color === "teal"
    ? "bg-teal-600/80 hover:bg-teal-600"
    : "bg-red-600/80 hover:bg-red-600";

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden theme-auth">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: accent.color === "teal"
            ? "radial-gradient(ellipse 800px 500px at 50% -80px, rgba(45,212,191,0.18) 0%, rgba(139,92,246,0.08) 50%, transparent 75%)"
            : "radial-gradient(ellipse 800px 500px at 50% -80px, rgba(239,68,68,0.18) 0%, rgba(139,92,246,0.08) 50%, transparent 75%)",
        }}
      />

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${badgeClass}`}>
          <BadgeIcon size={12} className={iconClass} />
          <span className="text-[11px] font-medium tracking-wide">{accent.badge}</span>
        </div>
      </div>

      <div className="auth-card">
        <div className="flex justify-center mb-8">
          <MushInLogo height={28} />
        </div>

        <div className="mb-7 text-center">
          <div className={`w-11 h-11 rounded-full border flex items-center justify-center mx-auto mb-4 ${iconWrapClass}`}>
            <BadgeIcon size={18} className={iconClass} />
          </div>
          <h1 className="text-lg font-semibold text-white tracking-tight">
            {mode === "support" ? "Support Portal" : "Admin Portal"}
          </h1>
          <p className="text-sm text-white/35 mt-1">Use your staff credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <StaffInput
            type="email"
            placeholder={mode === "support" ? "Support email" : "Admin email"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            icon={<Mail size={14} />}
          />

          <StaffInput
            type={showPw ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            icon={<Lock size={14} />}
            right={
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-white/25 hover:text-white/50 transition-colors"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            }
          />

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-10 rounded-lg font-semibold text-sm text-white mt-2
                        transition-colors duration-150 flex items-center justify-center gap-2
                        disabled:opacity-50 disabled:cursor-not-allowed ${buttonClass}`}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : "Continue"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/auth" className="text-[12px] text-white/25 hover:text-white/50 transition-colors">
            ← Back to main login
          </Link>
        </div>
      </div>
    </div>
  );
}

