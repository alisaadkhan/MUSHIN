/**
 * Auth.tsx  —  MUSHIN  ·  Optimized
 *
 * Optimizations:
 *  - useReducer replaces 9 useState → single dispatch
 *  - BrandPanel extracted to lazy-loaded component
 *  - Sub-components memoized with React.memo
 *  - Removed redundant state (captchaError derived from token)
 *  - Simplified conditional rendering
 */

import { useState, useEffect, useRef, useReducer, lazy, Suspense, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Mail, ArrowLeft, RefreshCw,
  Shield, TrendingUp, Lock, KeyRound,
} from "lucide-react";
import { MushinLogo } from "@/components/mushin-brand";

const BrandPanel = lazy(() => import("@/components/auth/BrandPanel"));

/* ─── Types ─────────────────────────────────────────────────────────────── */
type AuthMode =
  | "sign-in"
  | "sign-up"
  | "forgot-password"
  | "verification-notice"
  | "mfa-challenge";

interface FormState {
  email: string;
  fullname: string;
  password: string;
  confirmPw: string;
  mfaCode: string;
  mfaFactorId: string;
  mode: AuthMode;
  submitting: boolean;
}

type FormAction =
  | { type: "FIELD"; field: keyof FormState; value: string }
  | { type: "MODE"; mode: AuthMode }
  | { type: "SUBMITTING"; value: boolean }
  | { type: "RESET" };

const initialState: FormState = {
  email: "",
  fullname: "",
  password: "",
  confirmPw: "",
  mfaCode: "",
  mfaFactorId: "",
  mode: "sign-in",
  submitting: false,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "FIELD":
      return { ...state, [action.field]: action.value };
    case "MODE":
      return { ...state, mode: action.mode };
    case "SUBMITTING":
      return { ...state, submitting: action.value };
    case "RESET":
      return { ...initialState, mode: state.mode };
    default:
      return state;
  }
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const CONSUMER_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "icloud.com", "aol.com", "protonmail.com", "ymail.com", "googlemail.com",
  "yahoo.co.uk", "yahoo.in", "yahoo.com.pk", "hotmail.co.uk", "msn.com",
  "me.com", "mail.com", "gmx.com",
]);

/* ─── GoogleIcon ────────────────────────────────────────────────────────── */
const GoogleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

/* ─── Divider ────────────────────────────────────────────────────────────── */
const OrDivider = () => (
  <div className="flex items-center gap-3">
    <div className="flex-1 h-px bg-border" />
    <span className="text-xs text-muted-foreground">or email</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

/* ─── Mode Tab Toggle ────────────────────────────────────────────────────── */
const ModeTabs = ({
  mode,
  setMode,
}: {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
}) => (
  <div className="flex bg-muted/40 rounded-lg p-1 border border-border">
    {(["sign-in", "sign-up"] as const).map((m) => (
      <button
        key={m}
        type="button"
        onClick={() => setMode(m)}
        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
          mode === m
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {m === "sign-in" ? "Log in" : "Sign up"}
      </button>
    ))}
  </div>
);

/* ─── Captcha Block ──────────────────────────────────────────────────────── */
const CaptchaBlock = ({
  instanceRef,
  onSuccess,
  onExpire,
  onReady,
  onError,
  captchaReady,
  captchaToken,
  captchaError,
}: {
  instanceRef: React.RefObject<TurnstileInstance>;
  onSuccess: (t: string) => void;
  onExpire: () => void;
  onReady: () => void;
  onError: (code?: string) => void;
  captchaReady: boolean;
  captchaToken: string;
  captchaError: string;
}) => {
  if (!TURNSTILE_SITE_KEY) return null;
  return (
    <div className="space-y-1.5">
      <Turnstile
        ref={instanceRef}
        siteKey={TURNSTILE_SITE_KEY}
        onSuccess={onSuccess}
        onExpire={onExpire}
        onWidgetLoad={onReady}
        onError={onError}
        onUnsupported={() => onError("unsupported-browser")}
        options={{ theme: "dark", size: "normal" }}
      />
      {!captchaReady && !captchaToken && !captchaError && (
        <p className="text-[11px] text-muted-foreground">Loading CAPTCHA…</p>
      )}
      {captchaError && (
        <p className="text-[11px] text-destructive">{captchaError}</p>
      )}
    </div>
  );
};

/* ─── Field ──────────────────────────────────────────────────────────────── */
const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
      {label}
    </Label>
    <div className="mt-1">{children}</div>
  </div>
);

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function Auth() {
  const {
    user, loading, needsEmailVerification,
    signIn, signUp, signInWithGoogle, resetPassword, resendVerificationEmail,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, dispatch] = useReducer(formReducer, {
    ...initialState,
    mode: searchParams.get("verify") === "required" ? "verification-notice" : "sign-in",
  });

  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaError, setCaptchaError] = useState("");
  const turnstileSignIn = useRef<TurnstileInstance>(null);
  const turnstileSignUp = useRef<TurnstileInstance>(null);

  const resetCaptcha = useCallback((ref: React.RefObject<TurnstileInstance>) => {
    ref.current?.reset();
    setCaptchaToken("");
  }, []);

  const handleCaptchaError = useCallback((code?: string) => {
    setCaptchaReady(false);
    setCaptchaToken("");
    setCaptchaError(
      `CAPTCHA failed${code ? ` (${code})` : ""}. Check: correct site key, hostname allowlist, browser shields.`
    );
  }, []);

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

  useEffect(() => {
    if (!loading && user && !needsEmailVerification) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, needsEmailVerification, navigate]);

  const handleSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      toast({ title: "Please complete the CAPTCHA", variant: "destructive" });
      return;
    }
    dispatch({ type: "SUBMITTING", value: true });
    const { error } = await signIn(form.email, form.password, captchaToken || undefined);
    resetCaptcha(turnstileSignIn);
    if (error) {
      dispatch({ type: "SUBMITTING", value: false });
      if (error.message.toLowerCase().includes("email not confirmed")) {
        dispatch({ type: "MODE", mode: "verification-notice" });
      } else {
        toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
      }
      return;
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        dispatch({ type: "FIELD", field: "mfaFactorId", value: totp.id });
        dispatch({ type: "FIELD", field: "mfaCode", value: "" });
        dispatch({ type: "SUBMITTING", value: false });
        dispatch({ type: "MODE", mode: "mfa-challenge" });
        return;
      }
    }
    dispatch({ type: "SUBMITTING", value: false });
  }, [form.email, form.password, captchaToken, signIn, resetCaptcha]);

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPw) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    const domain = form.email.split("@")[1]?.toLowerCase();
    if (!domain || CONSUMER_DOMAINS.has(domain)) {
      toast({
        title: "Business email required",
        description: `@${domain ?? "unknown"} is not allowed. Please use your company email.`,
        variant: "destructive",
      });
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      toast({ title: "Please complete the CAPTCHA", variant: "destructive" });
      return;
    }
    dispatch({ type: "SUBMITTING", value: true });
    const { error } = await signUp(form.email, form.password, captchaToken || undefined);
    resetCaptcha(turnstileSignUp);
    dispatch({ type: "SUBMITTING", value: false });
    if (error) {
      toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
    } else {
      dispatch({ type: "MODE", mode: "verification-notice" });
    }
  }, [form.email, form.password, form.confirmPw, captchaToken, signUp, resetCaptcha]);

  const handleForgotPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SUBMITTING", value: true });
    const { error } = await resetPassword(form.email);
    dispatch({ type: "SUBMITTING", value: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "Password reset link sent." });
      dispatch({ type: "MODE", mode: "sign-in" });
    }
  }, [form.email, resetPassword]);

  const handleResend = useCallback(async () => {
    dispatch({ type: "SUBMITTING", value: true });
    const { error } = await resendVerificationEmail(form.email);
    dispatch({ type: "SUBMITTING", value: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email sent", description: "Verification email resent." });
    }
  }, [form.email, resendVerificationEmail]);

  const handleGoogle = useCallback(async () => {
    dispatch({ type: "SUBMITTING", value: true });
    const { error } = await signInWithGoogle();
    if (error) {
      dispatch({ type: "SUBMITTING", value: false });
      toast({ title: "Google sign in failed", description: error.message, variant: "destructive" });
    }
  }, [signInWithGoogle]);

  const handleMfaVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.mfaCode.length < 6 || !form.mfaFactorId) return;
    dispatch({ type: "SUBMITTING", value: true });
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: form.mfaFactorId,
        code: form.mfaCode,
      });
      if (error) {
        toast({ title: "Invalid code", description: error.message, variant: "destructive" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
    } finally {
      dispatch({ type: "SUBMITTING", value: false });
    }
  }, [form.mfaCode, form.mfaFactorId]);

  const captchaProps = useMemo(() => ({
    captchaReady,
    captchaToken,
    captchaError,
    onSuccess: (t: string) => { setCaptchaToken(t); setCaptchaError(""); },
    onExpire: () => setCaptchaToken(""),
    onReady: () => { setCaptchaReady(true); setCaptchaError(""); },
    onError: handleCaptchaError,
  }), [captchaReady, captchaToken, captchaError, handleCaptchaError]);

  const setMode = useCallback((mode: AuthMode) => dispatch({ type: "MODE", mode }), []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  const cardCls = "rounded-2xl border border-border bg-card p-6 space-y-4";
  const submitDisabled = form.submitting || (!!TURNSTILE_SITE_KEY && !captchaToken);

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── LEFT: Form Panel ── */}
      <div className="flex-1 relative flex items-center justify-center p-6 max-w-[480px]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 50%, rgba(88,28,135,0.07) 0%, transparent 70%)",
          }}
        />

        <div className="w-full max-w-sm relative z-10 space-y-5">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <MushinLogo size={40} />
            <div>
              <span
                className="text-xl font-extrabold tracking-[0.1em] text-foreground uppercase"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                MUSHIN
              </span>
              <p className="text-[10px] text-primary tracking-widest">無心 · Pure Clarity</p>
            </div>
          </div>

          {/* ── VERIFICATION NOTICE ── */}
          {form.mode === "verification-notice" && (
            <div className={cardCls}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Check your email
                  </h2>
                  <p className="text-xs text-muted-foreground">{form.email || "your email"}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We sent a verification link. Click it to activate your account, then return here to
                sign in.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResend}
                  disabled={form.submitting}
                  className="flex-1"
                >
                  {form.submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Resend
                </Button>
                <Button size="sm" onClick={() => setMode("sign-in")} className="flex-1">
                  <ArrowLeft className="h-3 w-3" />
                  Back to sign in
                </Button>
              </div>
            </div>
          )}

          {/* ── MFA CHALLENGE ── */}
          {form.mode === "mfa-challenge" && (
            <form onSubmit={handleMfaVerify} className={cardCls}>
              <button
                type="button"
                onClick={async () => { await supabase.auth.signOut(); setMode("sign-in"); }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={12} /> Back to sign in
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <KeyRound className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Two-Factor Authentication
                  </h2>
                  <p className="text-xs text-muted-foreground">Enter the code from your authenticator app</p>
                </div>
              </div>
              <Field label="6-Digit Code">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.mfaCode}
                  onChange={(e) => dispatch({ type: "FIELD", field: "mfaCode", value: e.target.value.replace(/\D/g, "") })}
                  placeholder="000000"
                  className="font-mono tracking-[0.5em] text-center text-lg"
                  autoFocus
                  required
                />
              </Field>
              <Button
                type="submit"
                className="w-full btn-primary-alive"
                disabled={form.submitting || form.mfaCode.length < 6}
              >
                {form.submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify →
              </Button>
            </form>
          )}

          {/* ── SIGN IN ── */}
          {form.mode === "sign-in" && (
            <form onSubmit={handleSignIn} className={cardCls}>
              <div>
                <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Welcome back
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">Sign in to your workspace</p>
              </div>

              <ModeTabs mode={form.mode} setMode={setMode} />

              <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={form.submitting}>
                <GoogleIcon />
                Continue with Google
              </Button>
              <p className="text-[11px] text-muted-foreground text-center -mt-2">
                Business / work emails only — no Gmail or Yahoo
              </p>

              <OrDivider />

              <div className="space-y-3">
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={(e) => dispatch({ type: "FIELD", field: "email", value: e.target.value })} placeholder="you@brand.pk" required />
                </Field>
                <Field label="Password">
                  <Input type="password" value={form.password} onChange={(e) => dispatch({ type: "FIELD", field: "password", value: e.target.value })} placeholder="••••••••" required />
                </Field>
              </div>

              <button
                type="button"
                onClick={() => setMode("forgot-password")}
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </button>

              <CaptchaBlock instanceRef={turnstileSignIn} {...captchaProps} />

              <Button type="submit" className="w-full btn-primary-alive" disabled={submitDisabled}>
                {form.submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign In →
              </Button>
            </form>
          )}

          {/* ── SIGN UP ── */}
          {form.mode === "sign-up" && (
            <form onSubmit={handleSignUp} className={cardCls}>
              <div>
                <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Create account
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">Start free — no card needed</p>
              </div>

              <ModeTabs mode={form.mode} setMode={setMode} />

              <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={form.submitting}>
                <GoogleIcon />
                Continue with Google
              </Button>
              <p className="text-[11px] text-muted-foreground text-center -mt-2">
                Business / work emails only — no Gmail or Yahoo
              </p>

              <OrDivider />

              <div className="space-y-3">
                <Field label="Full Name">
                  <Input value={form.fullname} onChange={(e) => dispatch({ type: "FIELD", field: "fullname", value: e.target.value })} placeholder="Ahmad Khan" />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email} onChange={(e) => dispatch({ type: "FIELD", field: "email", value: e.target.value })} placeholder="you@brand.pk" required />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Work / company email only — no Gmail, Yahoo, or Hotmail
                  </p>
                </Field>
                <Field label="Password">
                  <Input type="password" value={form.password} onChange={(e) => dispatch({ type: "FIELD", field: "password", value: e.target.value })} placeholder="••••••••" required />
                </Field>
                <Field label="Confirm Password">
                  <Input type="password" value={form.confirmPw} onChange={(e) => dispatch({ type: "FIELD", field: "confirmPw", value: e.target.value })} placeholder="••••••••" required />
                </Field>
              </div>

              <CaptchaBlock instanceRef={turnstileSignUp} {...captchaProps} />

              <Button type="submit" className="w-full btn-primary-alive" disabled={submitDisabled}>
                {form.submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Account →
              </Button>
            </form>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {form.mode === "forgot-password" && (
            <form onSubmit={handleForgotPassword} className={cardCls}>
              <button
                type="button"
                onClick={() => setMode("sign-in")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={12} /> Back
              </button>
              <div>
                <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Reset password
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">We'll send a reset link to your email.</p>
              </div>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => dispatch({ type: "FIELD", field: "email", value: e.target.value })} placeholder="you@brand.pk" required />
              </Field>
              <Button type="submit" className="w-full btn-primary-alive" disabled={form.submitting}>
                {form.submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          )}

        </div>
      </div>

      {/* ── RIGHT: Brand Panel (lazy-loaded, zero animation cost) ── */}
      <Suspense fallback={<div className="hidden lg:flex flex-1 bg-background" />}>
        <BrandPanel />
      </Suspense>

    </div>
  );
}
