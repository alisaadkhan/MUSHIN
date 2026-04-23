import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeClosed, ArrowRight, Headphones, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MushInIcon } from "@/components/ui/MushInLogo";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { invokeEdgeAuthed } from "@/lib/edge";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-purple-500 selection:text-white border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className
      )}
      {...props}
    />
  );
}

export default function SupportLogin() {
  const navigate = useNavigate();
  const { user, workspace } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"email" | "password" | null>(null);

  // If already authenticated as support/admin, redirect
  useEffect(() => {
    if (user && workspace) {
      const role = workspace.role ?? "";
      if (["support", "admin", "super_admin"].includes(role)) {
        navigate("/support/dashboard", { replace: true });
      }
    }
  }, [user, workspace, navigate]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };
  const handleMouseLeave = () => { mouseX.set(0); mouseY.set(0); };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast({ title: "Access Denied", description: "Invalid credentials.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Verify the user has support access (server-side). Avoid any direct DB query from the client.
      const { data: perms, error: permErr } = await invokeEdgeAuthed<{ permissions: { tier: string | null } }>(
        "support-permissions",
        { body: {} } as any,
      );
      if (permErr) throw permErr;

      if (!perms?.permissions?.tier) {
        toast({
          title: "Access Denied",
          description: "This account does not have support staff access.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      toast({ title: "Welcome", description: "Accessing support dashboard…" });
      navigate("/support/dashboard");
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-black relative overflow-hidden flex items-center justify-center">
      {/* Teal/purple background theme for support */}
      <div className="absolute inset-0 bg-gradient-to-b from-teal-600/20 via-purple-900/40 to-black" />

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px'
        }}
      />

      {/* Glow blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vh] h-[60vh] rounded-b-[50%] bg-teal-400/15 blur-[80px]" />
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90vh] h-[90vh] rounded-t-full bg-teal-500/10 blur-[60px]"
        animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, repeatType: "mirror" }}
      />

      {/* Access badge */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/10 border border-teal-500/30 backdrop-blur-sm">
          <AlertCircle className="w-4 h-4 text-teal-400" />
          <span className="text-xs text-teal-300 font-medium">Support Staff Portal — Restricted</span>
        </div>
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-sm relative z-10"
        style={{ perspective: 1500 }}
      >
        <motion.div
          className="relative"
          style={{ rotateX, rotateY }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="relative group">
            {/* Animated border beams — teal colour */}
            <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
              {[
                { className: "absolute top-0 left-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-teal-400 to-transparent", anim: { left: ["-50%", "100%"] }, delay: 0 },
                { className: "absolute top-0 right-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-teal-400 to-transparent", anim: { top: ["-50%", "100%"] }, delay: 0.6 },
                { className: "absolute bottom-0 right-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-teal-400 to-transparent", anim: { right: ["-50%", "100%"] }, delay: 1.2 },
                { className: "absolute bottom-0 left-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-teal-400 to-transparent", anim: { bottom: ["-50%", "100%"] }, delay: 1.8 },
              ].map((b, i) => (
                <motion.div key={i} className={b.className + " opacity-70"}
                  animate={b.anim as any}
                  transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: b.delay }}
                />
              ))}
            </div>

            {/* Glass card */}
            <div className="relative bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-white/[0.05] shadow-2xl overflow-hidden">
              <div className="absolute inset-0 opacity-[0.03]"
                style={{ backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)`, backgroundSize: '30px 30px' }}
              />

              {/* Header */}
              <div className="text-center space-y-1 mb-6">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="mx-auto w-12 h-12 rounded-full border border-teal-500/30 flex items-center justify-center bg-teal-500/10"
                >
                  <Headphones className="w-6 h-6 text-teal-400" />
                </motion.div>
                <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="text-xl font-bold text-white">
                  Support Portal
                </motion.h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="text-teal-300/60 text-xs">
                  Internal Access Only
                </motion.p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className="relative flex items-center overflow-hidden rounded-lg">
                  <Mail className={`absolute left-3 w-4 h-4 transition-colors duration-300 ${focusedInput === "email" ? "text-teal-400" : "text-white/40"}`} />
                  <Input
                    type="email"
                    placeholder="Support Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedInput("email")}
                    onBlur={() => setFocusedInput(null)}
                    required
                    autoComplete="email"
                    className="w-full bg-white/5 border-transparent focus:border-teal-500/30 text-white placeholder:text-white/30 h-10 pl-10 pr-3 focus:bg-white/10"
                  />
                </div>

                {/* Password */}
                <div className="relative flex items-center overflow-hidden rounded-lg">
                  <Lock className={`absolute left-3 w-4 h-4 transition-colors duration-300 ${focusedInput === "password" ? "text-teal-400" : "text-white/40"}`} />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedInput("password")}
                    onBlur={() => setFocusedInput(null)}
                    required
                    autoComplete="current-password"
                    className="w-full bg-white/5 border-transparent focus:border-teal-500/30 text-white placeholder:text-white/30 h-10 pl-10 pr-10 focus:bg-white/10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-white/40 hover:text-white transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <Eye className="w-4 h-4" /> : <EyeClosed className="w-4 h-4" />}
                  </button>
                </div>

                {/* Submit */}
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  type="submit" disabled={isLoading}
                  className="w-full relative group/button mt-2"
                >
                  <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 to-purple-600 text-white font-medium h-10 rounded-lg flex items-center justify-center disabled:opacity-60">
                    <AnimatePresence mode="wait">
                      {isLoading ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                        </motion.div>
                      ) : (
                        <motion.span key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5 text-sm font-medium">
                          <Headphones className="w-3.5 h-3.5" />
                          Support Access
                          <ArrowRight className="w-3 h-3 group-hover/button:translate-x-1 transition-transform duration-300" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>

                <div className="text-center mt-3">
                  <Link to="/auth" className="text-xs text-white/30 hover:text-white/60 transition-colors">
                    ← Back to main login
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
