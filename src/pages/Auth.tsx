import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuroraBackground } from "@/components/layout/AuroraBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Zap, Loader2, Mail, ArrowLeft, Lock, User, Globe, RefreshCw, Sparkles, TrendingUp, Shield } from "lucide-react";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "verification-notice";

export default function Auth() {
  const { user, loading, needsEmailVerification, signIn, signUp, signInWithGoogle, resetPassword, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<AuthMode>(
    searchParams.get("verify") === "required" ? "verification-notice" : "sign-in"
  );
  const [email, setEmail] = useState("");
  const [fullname, setFullname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (!loading && user && !needsEmailVerification) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, needsEmailVerification, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setMode("verification-notice");
      } else {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(email, password);
    setSubmitting(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } else {
      setMode("verification-notice");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await resetPassword(email);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "We sent a password reset link." });
      setMode("sign-in");
    }
  };

  const handleResend = async () => {
    setSubmitting(true);
    const { error } = await resendVerificationEmail(email);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email sent", description: "Verification email resent." });
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    const { error } = await signInWithGoogle();
    setSubmitting(false);
    if (error) {
      toast({ title: "Google sign in failed", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <AuroraBackground />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side: Form */}
      <div className="flex-1 relative flex items-center justify-center bg-background p-4">
        <AuroraBackground />
        <div className="glass-card w-full max-w-md space-y-6 p-8 relative z-10">
          {/* Logo */}
          <div className="flex flex-col items-center justify-center gap-2 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight mt-2">
              <span className="aurora-text">Influence</span>
              <span className="text-foreground">IQ</span>
            </span>
          </div>

          {(mode === "sign-in" || mode === "sign-up") && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-foreground">
                  {mode === "sign-in" ? "Welcome back" : "Create your account"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {mode === "sign-in" ? "Sign in to your InfluenceIQ account" : "Get started with InfluenceIQ for free"}
                </p>
              </div>

              {/* Tab switcher */}
              <div className="flex bg-muted/50 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMode("sign-in")}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "sign-in" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("sign-up")}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "sign-up" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Sign up
                </button>
              </div>

              <form onSubmit={mode === "sign-in" ? handleSignIn : handleSignUp} className="space-y-4">
                {mode === "sign-up" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullname">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="fullname" type="text" placeholder="John Doe" className="pl-9 h-10" value={fullname} onChange={(e) => setFullname(e.target.value)} />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="pl-9 h-10" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} className="pl-9 h-10" />
                  </div>
                </div>

                {mode === "sign-up" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="pl-9 h-10" />
                    </div>
                  </div>
                )}

                {mode === "sign-in" && (
                  <div className="flex justify-end">
                    <button type="button" className="text-xs text-primary hover:underline font-medium" onClick={() => setMode("forgot-password")}>
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button type="submit" className="w-full btn-shine h-10" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {mode === "sign-in" ? "Sign in" : "Create account"}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
                <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-muted-foreground rounded-full border border-border/50">or continue with</span></div>
              </div>

              <Button type="button" variant="outline" className="w-full h-10 bg-white" onClick={handleGoogle} disabled={submitting}>
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                Google
              </Button>
            </div>
          )}

          {/* Forgot Password */}
          {mode === "forgot-password" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <button type="button" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4" onClick={() => setMode("sign-in")}>
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </button>
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-foreground">Reset your password</h2>
                <p className="text-sm text-muted-foreground mt-1">Enter your email and we'll send you a reset link.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="pl-9 h-10" />
                </div>
              </div>
              <Button type="submit" className="w-full btn-shine h-10" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Reset Link
              </Button>
            </form>
          )}

          {/* Verification Notice */}
          {mode === "verification-notice" && (
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground mb-2">Check your email</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We sent a verification link to <span className="font-medium text-foreground">{email || "your email"}</span>.<br />Please verify your account before signing in.
                </p>
              </div>
              <div className="space-y-3 pt-4 border-t border-border/50">
                <Button variant="outline" className="w-full h-10" onClick={handleResend} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Resend Verification Email
                </Button>
                <button type="button" className="text-sm text-muted-foreground hover:text-foreground font-medium" onClick={() => setMode("sign-in")}>
                  Back to sign in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Dark Value Prop Panel */}
      <div className="hidden lg:flex lg:w-[480px] bg-foreground text-background relative overflow-hidden flex-col justify-center p-12">
        {/* CSS abstract graphic */}
        <div className="absolute top-20 right-10 w-40 h-40 rounded-full border border-background/10" />
        <div className="absolute top-32 right-20 w-24 h-24 rounded-full bg-primary/30 blur-2xl" />
        <div className="absolute bottom-20 left-10 w-32 h-32 rounded-full border border-background/10" />
        <div className="absolute bottom-32 left-20 w-20 h-20 rounded-full bg-primary/10 blur-xl" />

        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-6">Start measuring real influence today</h2>
          <ul className="space-y-4">
            {[
              { icon: Sparkles, text: "AI-powered authenticity scoring" },
              { icon: TrendingUp, text: "Predict campaign ROI before you spend" },
              { icon: Shield, text: "Detect fake followers instantly" },
              { icon: Lock, text: "Enterprise-grade security" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-sm text-background/80">
                <item.icon size={18} strokeWidth={1.5} className="text-primary flex-shrink-0" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
