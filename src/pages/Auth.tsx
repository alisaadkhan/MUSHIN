import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_DISABLE_CAPTCHA === "true"
  ? null
  : (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "");

import { AuroraBackground } from "@/components/layout/AuroraBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Mail, ArrowLeft, Lock, User,
  RefreshCw, TrendingUp, Shield, KeyRound,
} from "lucide-react";
import { MushinLogo } from "@/components/mushin-brand";

// ─── Types ─────────────────────────────────────────────────────────────────────
type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "verification-notice" | "mfa-challenge";

// ─── Consumer domain blocklist ─────────────────────────────────────────────────
const CONSUMER_DOMAINS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com",
  "aol.com", "protonmail.com", "ymail.com", "googlemail.com", "yahoo.co.uk", "yahoo.in",
  "yahoo.com.pk", "hotmail.co.uk", "msn.com", "me.com", "mail.com", "gmx.com",
];

// ─── Google Icon (extracted to avoid JSX bloat) ────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Auth Tab Switcher ─────────────────────────────────────────────────────────
function AuthTabs({ mode, onSwitch }: { mode: AuthMode; onSwitch: (m: AuthMode) => void }) {
  return (
    <div className="flex bg-white/[0.03] rounded-lg p-1 border border-white/[0.07] gap-1">
      <button
        type="button"
        onClick={() => onSwitch("sign-in")}
        className={`auth-tab ${mode === "sign-in" ? "auth-tab-active" : "auth-tab-inactive"}`}
      >
        Log in
      </button>
      <button
        type="button"
        onClick={() => onSwitch("sign-up")}
        className={`auth-tab ${mode === "sign-up" ? "auth-tab-active" : "auth-tab-inactive"}`}
      >
        Sign up
      </button>
    </div>
  );
}

// ─── CAPTCHA Block ─────────────────────────────────────────────────────────────
function CaptchaBlock({
  turnstileRef,
  onSuccess,
  onExpire,
  onLoad,
  onError,
  captchaToken,
  captchaError,
}: {
  turnstileRef: React.RefObject<TurnstileInstance>;
  onSuccess: (token: string) => void;
  onExpire: () => void;
  onLoad: () => void;
  onError: (code?: string) => void;
  captchaToken: string;
  captchaError: string;
}) {
  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className="space-y-2">
      {/* Skeleton shown while Turnstile hasn't loaded yet */}
      {!captchaToken && !captchaError && (
        <div className="captcha-skeleton" aria-label="Loading security check…" />
      )}
      <div className={captchaToken || captchaError ? "block" : "sr-only"}>
        <Turnstile
          ref={turnstileRef}
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={(token) => { onSuccess(token); }}
          onExpire={onExpire}
          onWidgetLoad={onLoad}
          onError={onError}
          onUnsupported={() => onError("unsupported-browser")}
          options={{ theme: "dark", size: "normal" }}
        />
      </div>
      {captchaError && (
        <p className="text-[11px] text-destructive leading-relaxed">{captchaError}</p>
      )}
    </div>
  );
}

// ─── Form Field ────────────────────────────────────────────────────────────────
function Field({
  label, children,
}: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Auth() {
  const {
    user, loading, needsEmailVerification,
    signIn, signUp, signInWithGoogle, resetPassword, resendVerificationEmail,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<AuthMode>(
    searchParams.get("verify") === "required" ? "verification-notice" : "sign-in"
  );
  const [email, setEmail]                   = useState("");
  const [fullname, setFullname]             = useState("");
  const [password, setPassword]             = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [cooldown, setCooldown]             = useState(false);  // submit rate-limit
  const [mfaCode, setMfaCode]               = useState("");
  const [mfaFactorId, setMfaFactorId]       = useState("");
  const [captchaToken, setCaptchaToken]     = useState("");
  const [captchaError, setCaptchaError]     = useState("");

  const turnstileSignIn = useRef<TurnstileInstance>(null);
  const turnstileSignUp = useRef<TurnstileInstance>(null);

  // ── Redirect when authenticated ──────────────────────────────────────────────
  useEffect(() => {
    if (!loading && user && !needsEmailVerification) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, needsEmailVerification, navigate]);

  // ── Check for Google OAuth consumer-domain block ─────────────────────────────
  useEffect(() => {
    const blocked = localStorage.getItem("auth_google_blocked");
    if (blocked) {
      localStorage.removeItem("auth_google_blocked");
      toast({
        title: "Business emails only",
        description: `@${blocked} is a personal email. Please use your work or business email.`,
        variant: "destructive",
      });
    }
  }, []);

  // ── CAPTCHA helpers ──────────────────────────────────────────────────────────
  const resetCaptcha = useCallback((ref: React.RefObject<TurnstileInstance>) => {
    ref.current?.reset();
    setCaptchaToken("");
  }, []);

  const handleCaptchaError = useCallback((errorCode?: string) => {
    setCaptchaToken("");
    const detail = errorCode ? ` (${errorCode})` : "";
    setCaptchaError(
      `Security check failed${detail}. Disable browser shields or try a different browser.`
    );
  }, []);

  // ── Submit rate-limit cooldown (1 s after failure) ───────────────────────────
  const triggerCooldown = useCallback(() => {
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1000);
  }, []);

  const captchaRequired = !!TURNSTILE_SITE_KEY && !captchaToken;

  // ── Sign In ──────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaRequired) {
      toast({ title: "Please complete the security check", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email, password, captchaToken || undefined);
    resetCaptcha(turnstileSignIn);

    if (error) {
      setSubmitting(false);
      triggerCooldown();
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setMode("verification-notice");
      } else {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      }
      return;
    }

    // MFA check
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

  // ── Sign Up ──────────────────────────────────────────────────────────────────
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
        description: `@${domain ?? "unknown"} is not allowed. Please use your company email.`,
        variant: "destructive",
      });
      return;
    }
    if (captchaRequired) {
      toast({ title: "Please complete the security check", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(email, password, captchaToken || undefined);
    resetCaptcha(turnstileSignUp);
    setSubmitting(false);
    if (error) {
      triggerCooldown();
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } else {
      setMode("verification-notice");
    }
  };

  // ── Forgot Password ──────────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await resetPassword(email);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "Password reset link sent." });
      setMode("sign-in");
    }
  };

  // ── Resend verification ──────────────────────────────────────────────────────
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

  // ── Google OAuth ─────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setSubmitting(true);
    const { error } = await signInWithGoogle();
    setSubmitting(false);
    if (error) {
      toast({ title: "Google sign in failed", description: error.message, variant: "destructive" });
    }
  };

  // ── MFA verify ──────────────────────────────────────────────────────────────
  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length < 6 || !mfaFactorId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode });
      if (error) {
        toast({ title: "Invalid code", description: error.message, variant: "destructive" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      toast({ title: "Verification failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <AuroraBackground />
        <Loader2 className="h-6 w-6 animate-spin text-primary opacity-60" />
      </div>
    );
  }

  const isSubmitDisabled = submitting || cooldown || captchaRequired;

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left: Form Panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-6 max-w-[480px]">
        <AuroraBackground />

        <div className="w-full max-w-[360px] relative z-10">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <MushinLogo size={36} />
            <div>
              <span
                className="text-lg font-extrabold tracking-[0.12em] text-foreground uppercase"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                MUSHIN
              </span>
              <p className="text-[10px] text-primary tracking-widest mt-0.5">無心 · Pure Clarity</p>
            </div>
          </div>

          {/* ── Verification Notice ─────────────────────────────────────────── */}
          {mode === "verification-notice" && (
            <GlassCard className="p-6 space-y-5 auth-card-enter">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Check your email
                  </h2>
                  <p className="text-[11px] text-white/40 mt-0.5">{email || "your email"}</p>
                </div>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">
                We sent a verification link. Click it to activate your account, then return here to sign in.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResend}
                  disabled={submitting}
                  className="flex-1 h-10 border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/60 hover:text-white/90 transition-all"
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Resend
                </Button>
                <Button
                  size="sm"
                  onClick={() => setMode("sign-in")}
                  className="flex-1 h-10 btn-primary-alive"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to sign in
                </Button>
              </div>
            </GlassCard>
          )}

          {/* ── MFA Challenge ──────────────────────────────────────────────── */}
          {mode === "mfa-challenge" && (
            <GlassCard className="p-6 space-y-5 auth-card-enter">
              <form onSubmit={handleMfaVerify} className="space-y-5">
              <button
                type="button"
                onClick={() => { setMode("sign-in"); supabase.auth.signOut(); }}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/75 transition-colors"
              >
                <ArrowLeft size={12} /> Back to sign in
              </button>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <KeyRound className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Two-Factor Auth
                  </h2>
                  <p className="text-[11px] text-white/40 mt-0.5">Enter the code from your authenticator app</p>
                </div>
              </div>

              <Field label="6-Digit Code">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000 000"
                  className="font-mono tracking-[0.4em] text-center text-lg"
                  autoFocus
                  required
                />
              </Field>

              <Button
                type="submit"
                className="w-full h-11 btn-primary-alive"
                disabled={submitting || mfaCode.length < 6}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify →
              </Button>
            </form>
            </GlassCard>
          )}

          {/* ── Sign In ────────────────────────────────────────────────────── */}
          {mode === "sign-in" && (
            <GlassCard className="p-6 space-y-5 auth-card-enter">
              <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <h2
                  className="text-[1.375rem] font-extrabold text-foreground leading-tight"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  Welcome back
                </h2>
                <p className="text-sm text-white/45 mt-1.5">Sign in to your workspace</p>
              </div>

              <AuthTabs mode={mode} onSwitch={setMode} />

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={submitting}
                className="google-btn w-full flex items-center justify-center gap-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
              <p className="text-[11px] text-white/35 text-center -mt-3">
                Business / work emails only — no Gmail or Yahoo
              </p>

              {/* Divider */}
              <div className="auth-divider">
                <span className="text-[11px] text-white/30">or email</span>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@brand.pk"
                    required
                    autoComplete="email"
                  />
                </Field>
                <Field label="Password">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </Field>
              </div>

              {/* Forgot password — right-aligned */}
              <div className="flex justify-end -mt-2">
                <button
                  type="button"
                  onClick={() => setMode("forgot-password")}
                  className="text-xs text-primary/80 hover:text-primary transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* CAPTCHA */}
              <CaptchaBlock
                turnstileRef={turnstileSignIn}
                onSuccess={(token) => { setCaptchaToken(token); setCaptchaError(""); }}
                onExpire={() => setCaptchaToken("")}
                onLoad={() => setCaptchaError("")}
                onError={handleCaptchaError}
                captchaToken={captchaToken}
                captchaError={captchaError}
              />

              <Button
                type="submit"
                className="w-full h-11 btn-primary-alive"
                disabled={isSubmitDisabled}
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Lock className="h-4 w-4" />
                }
                Sign In
              </Button>
            </form>
            </GlassCard>
          )}

          {/* ── Sign Up ────────────────────────────────────────────────────── */}
          {mode === "sign-up" && (
            <GlassCard className="p-6 space-y-5 auth-card-enter">
              <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <h2
                  className="text-[1.375rem] font-extrabold text-foreground leading-tight"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  Create account
                </h2>
                <p className="text-sm text-white/45 mt-1.5">Start free — no card needed</p>
              </div>

              <AuthTabs mode={mode} onSwitch={setMode} />

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={submitting}
                className="google-btn w-full flex items-center justify-center gap-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
              <p className="text-[11px] text-white/35 text-center -mt-3">
                Business / work emails only — no Gmail or Yahoo
              </p>

              {/* Divider */}
              <div className="auth-divider">
                <span className="text-[11px] text-white/30">or email</span>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                <Field label="Full Name">
                  <Input
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    placeholder="Ahmad Khan"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@brand.pk"
                    required
                    autoComplete="email"
                  />
                  <p className="text-[11px] text-white/30 mt-1">Work / company email only</p>
                </Field>
                <Field label="Password">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirm Password">
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                </Field>
              </div>

              {/* CAPTCHA */}
              <CaptchaBlock
                turnstileRef={turnstileSignUp}
                onSuccess={(token) => { setCaptchaToken(token); setCaptchaError(""); }}
                onExpire={() => setCaptchaToken("")}
                onLoad={() => setCaptchaError("")}
                onError={handleCaptchaError}
                captchaToken={captchaToken}
                captchaError={captchaError}
              />

              <Button
                type="submit"
                className="w-full h-11 btn-primary-alive"
                disabled={isSubmitDisabled}
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <User className="h-4 w-4" />
                }
                Create Account →
              </Button>
            </form>
            </GlassCard>
          )}

          {/* ── Forgot Password ─────────────────────────────────────────────── */}
          {mode === "forgot-password" && (
            <GlassCard className="p-6 space-y-5 auth-card-enter">
              <form onSubmit={handleForgotPassword} className="space-y-5">
              <button
                type="button"
                onClick={() => setMode("sign-in")}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/75 transition-colors"
              >
                <ArrowLeft size={12} /> Back
              </button>

              <div>
                <h2
                  className="text-[1.375rem] font-extrabold text-foreground leading-tight"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  Reset password
                </h2>
                <p className="text-sm text-white/45 mt-1.5">We'll send a reset link to your email.</p>
              </div>

              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@brand.pk"
                  required
                  autoComplete="email"
                />
              </Field>

              <Button
                type="submit"
                className="w-full h-11 btn-primary-alive"
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
            </GlassCard>
          )}
        </div>
      </div>

      {/* ── Right: Brand Panel ───────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 flex-col justify-center p-14 border-l border-white/[0.06] relative overflow-hidden">
        <div className="absolute inset-0 animated-mesh-bg opacity-70" />
        <div className="absolute inset-0 dot-grid-overlay opacity-30" />

        <div className="relative z-10 max-w-md">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/[0.08] mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-dot" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              Pakistan's Creator Intelligence Platform
            </span>
          </div>

          {/* Hero heading */}
          <h1
            className="text-[2.75rem] font-extrabold text-foreground leading-[1.05] mb-5"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            無心 — Pure clarity.
            <br />
            <span className="aurora-text">Real creators.</span>
          </h1>

          <p className="text-sm text-white/45 leading-relaxed mb-10 max-w-sm">
            MUSHIN means "no mind" — the samurai state of total clarity. We bring
            that clarity to creator discovery. Cut through fake followers. See what's real.
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-10">
            {([
              ["10K+", "Creators Indexed"],
              ["98.2%", "Fraud Accuracy"],
              ["12+",  "Cities Covered"],
              ["4.2×", "Avg ROAS Lift"],
            ] as [string, string][]).map(([v, l]) => (
              <div
                key={l}
                className="glass-card p-4 group hover:border-primary/25 transition-colors"
              >
                <div
                  className="text-[1.625rem] font-extrabold text-primary leading-none mb-1"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  {v}
                </div>
                <div className="text-[11px] text-white/40 uppercase tracking-[0.08em]">{l}</div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex gap-5">
            {([
              [Shield,     "Fraud scored"],
              [TrendingUp, "AI powered"],
              [Lock,       "GDPR safe"],
            ] as [typeof Shield, string][]).map(([Icon, label]) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-white/35">
                <Icon size={13} className="text-primary/70" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
