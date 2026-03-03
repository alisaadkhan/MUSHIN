import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AuroraBackground } from "@/components/layout/AuroraBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail, ArrowLeft, Lock, User, RefreshCw, TrendingUp, Shield, KeyRound } from "lucide-react";
import { MushinLogo } from "@/components/mushin-brand";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "verification-notice" | "mfa-challenge";

const CONSUMER_DOMAINS = [
  "gmail.com","yahoo.com","hotmail.com","outlook.com","live.com","icloud.com",
  "aol.com","protonmail.com","ymail.com","googlemail.com","yahoo.co.uk","yahoo.in",
  "yahoo.com.pk","hotmail.co.uk","msn.com","me.com","mail.com","gmx.com",
];

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
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");

  // Check if Google OAuth was blocked (consumer domain) after redirect
  useEffect(() => {
    const blocked = localStorage.getItem("auth_google_blocked");
    if (blocked) {
      localStorage.removeItem("auth_google_blocked");
      toast({
        title: "Business emails only",
        description: `@${blocked} is a personal email. Please use your work or business email with Google Sign-In.`,
        variant: "destructive",
      });
    }
  }, []);

  useEffect(() => {
    if (!loading && user && !needsEmailVerification) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, needsEmailVerification, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      setSubmitting(false);
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setMode("verification-notice");
      } else {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      }
      return;
    }
    // Check if MFA challenge is required
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        setMfaFactorId(totp.id);
        setMfaCode("");
        setSubmitting(false);
        setMode("mfa-challenge");
        return;
      }
    }
    setSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain || CONSUMER_DOMAINS.includes(domain)) {
      toast({
        title: "Business email required",
        description: `Sign-ups with @${domain ?? "unknown"} are not allowed. Please use your company email address.`,
        variant: "destructive",
      });
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

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length < 6 || !mfaFactorId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode });
      if (error) {
        toast({ title: "Invalid code", description: error.message, variant: "destructive" });
      }
      // On success, onAuthStateChange will fire and navigate to dashboard
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
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
    <div className="min-h-screen flex bg-background">
      {/* Left: Form panel */}
      <div className="flex-1 relative flex items-center justify-center p-6 max-w-[480px]">
        <AuroraBackground />
        <div className="w-full max-w-sm relative z-10 space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <MushinLogo size={40} />
            <div>
              <span className="text-xl font-extrabold tracking-[0.1em] text-foreground uppercase" style={{ fontFamily: "'Syne',sans-serif" }}>
                MUSHIN
              </span>
              <p className="text-[10px] text-primary tracking-widest">無心 · Pure Clarity</p>
            </div>
          </div>

          {mode === "verification-notice" && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground" style={{ fontFamily: "'Syne',sans-serif" }}>Check your email</h2>
                  <p className="text-xs text-muted-foreground">{email || "your email"}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We sent a verification link. Click it to activate your account, then return here to sign in.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleResend} disabled={submitting} className="flex-1">
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Resend
                </Button>
                <Button size="sm" onClick={() => setMode("sign-in")} className="flex-1">
                  <ArrowLeft className="h-3 w-3" /> Back to sign in
                </Button>
              </div>
            </div>
          )}

          {mode === "mfa-challenge" && (
            <form onSubmit={handleMfaVerify} className="glass-card p-6 space-y-5">
              <button type="button" onClick={() => { setMode("sign-in"); supabase.auth.signOut(); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft size={12} /> Back to sign in
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground" style={{ fontFamily: "'Syne',sans-serif" }}>Two-Factor Authentication</h2>
                  <p className="text-xs text-muted-foreground">Enter the code from your authenticator app</p>
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">6-Digit Code</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="mt-1 font-mono tracking-[0.5em] text-center text-lg"
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" className="w-full btn-primary-alive" disabled={submitting || mfaCode.length < 6}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify →
              </Button>
            </form>
          )}

          {mode === "sign-in" && (
            <form onSubmit={handleSignIn} className="glass-card p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne',sans-serif" }}>Welcome back</h2>
                <p className="text-sm text-muted-foreground mt-1">Sign in to your workspace</p>
              </div>

              {/* Mode tabs */}
              <div className="flex bg-muted/40 rounded-lg p-1 border border-border">
                <button type="button" onClick={() => setMode("sign-in")}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary border border-primary/20 transition-all">
                  Log in
                </button>
                <button type="button" onClick={() => setMode("sign-up")}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground transition-all">
                  Sign up
                </button>
              </div>

              <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={submitting}>
                <svg width="15" height="15" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </Button>
              <p className="text-[11px] text-muted-foreground text-center -mt-1">Business / work emails only — no Gmail or Yahoo</p>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or email</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.pk" className="mt-1" required />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" required />
                </div>
              </div>

              <button type="button" onClick={() => setMode("forgot-password")} className="text-xs text-primary hover:underline">
                Forgot password?
              </button>

              <Button type="submit" className="w-full btn-primary-alive" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign In →
              </Button>
            </form>
          )}

          {mode === "sign-up" && (
            <form onSubmit={handleSignUp} className="glass-card p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne',sans-serif" }}>Create account</h2>
                <p className="text-sm text-muted-foreground mt-1">Start free — no card needed</p>
              </div>
              <div className="flex bg-muted/40 rounded-lg p-1 border border-border">
                <button type="button" onClick={() => setMode("sign-in")}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground transition-all">
                  Log in
                </button>
                <button type="button" onClick={() => setMode("sign-up")}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-md bg-primary/10 text-primary border border-primary/20 transition-all">
                  Sign up
                </button>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={submitting}>
                <svg width="15" height="15" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </Button>
              <p className="text-[11px] text-muted-foreground text-center -mt-1">Business / work emails only — no Gmail or Yahoo</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or email</span><div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full Name</Label>
                  <Input value={fullname} onChange={(e) => setFullname(e.target.value)} placeholder="Ahmad Khan" className="mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.pk" className="mt-1" required />
                  <p className="text-[11px] text-muted-foreground mt-1">Work / company email only — no Gmail, Yahoo, or Hotmail</p>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1" required />
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirm Password</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="mt-1" required />
                </div>
              </div>
              <Button type="submit" className="w-full btn-primary-alive" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Account →
              </Button>
            </form>
          )}

          {mode === "forgot-password" && (
            <form onSubmit={handleForgotPassword} className="glass-card p-6 space-y-4">
              <button type="button" onClick={() => setMode("sign-in")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft size={12} /> Back
              </button>
              <div>
                <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne',sans-serif" }}>Reset password</h2>
                <p className="text-sm text-muted-foreground mt-1">We'll send a reset link to your email.</p>
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.pk" className="mt-1" required />
              </div>
              <Button type="submit" className="w-full btn-primary-alive" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Right: Brand panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-center p-12 border-l border-border relative overflow-hidden">
        <div className="absolute inset-0 animated-mesh-bg opacity-60" />
        <div className="absolute inset-0 dot-grid-overlay" />
        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/35 bg-primary/10 mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-dot" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Pakistan's Creator Intelligence Platform</span>
          </div>
          <h1 className="text-4xl font-extrabold text-foreground leading-tight mb-4" style={{ fontFamily: "'Syne',sans-serif" }}>
            無心 — Pure clarity.<br />
            <span className="aurora-text">Real creators.</span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            MUSHIN means "no mind" — the samurai state of total clarity. We bring that clarity to creator discovery. Cut through fake followers. See what's real.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[["10K+","Creators Indexed"],["98.2%","Fraud Accuracy"],["12+","Cities Covered"],["4.2×","Avg ROAS Lift"]].map(([v,l]) => (
              <div key={l} className="glass-card p-4">
                <div className="text-xl font-extrabold text-primary" style={{ fontFamily: "'Syne',sans-serif" }}>{v}</div>
                <div className="text-xs text-muted-foreground mt-1">{l}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-8">
            {[Shield, TrendingUp, Lock].map((Icon, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon size={12} className="text-primary" />
                {["Fraud scored","AI powered","GDPR safe"][i]}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
