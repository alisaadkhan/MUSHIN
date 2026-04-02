import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

// ─── Security Constants ────────────────────────────────────────────────────────
const TURN_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const DISABLE_CAPTCHA = import.meta.env.VITE_DISABLE_CAPTCHA === "true";
const TOKEN_EXPIRY_MS = 110 * 1000; // 1:50 safety margin for 2min window

// ─── Managed Turnstile Component ───────────────────────────────────────────────
// React.memo ensures the component doesn't re-render unless siteKey or handlers change.
const ManagedTurnstile = memo(({ 
  id, 
  siteKey, 
  onSuccess, 
  onError, 
  onExpire, 
  turnstileRef 
}: {
  id: string;
  siteKey: string;
  onSuccess: (token: string) => void;
  onError: (code?: string) => void;
  onExpire: () => void;
  turnstileRef: React.RefObject<TurnstileInstance>;
}) => {
  return (
    <Turnstile
      id={id}
      ref={turnstileRef}
      siteKey={siteKey}
      onSuccess={onSuccess}
      onError={onError}
      onExpire={onExpire}
      options={{ theme: "dark", size: "normal" }}
    />
  );
});

ManagedTurnstile.displayName = "ManagedTurnstile";

import { AuroraBackground } from "@/components/layout/AuroraBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Mail, ArrowLeft,
  RefreshCw, Shield, KeyRound,
  AlertCircle,
} from "lucide-react";
import { MushinLogo } from "@/components/mushin-brand";

// ─── Types ─────────────────────────────────────────────────────────────────────
type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "verification-notice" | "mfa-challenge";

interface CaptchaState {
  token: string;
  timestamp: number;
  error: string;
  ready: boolean;
}

// ─── Consumer domain blocklist ─────────────────────────────────────────────────
const CONSUMER_DOMAINS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com",
  "aol.com", "protonmail.com", "ymail.com", "googlemail.com", "yahoo.co.uk", "yahoo.in",
  "yahoo.com.pk", "hotmail.co.uk", "msn.com", "me.com", "mail.com", "gmx.com",
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Auth() {
  // CRITICAL: Hard failure if Site Key is missing and not disabled
  if (!TURN_SITE_KEY && !DISABLE_CAPTCHA) {
    throw new Error("CRITICAL_SECURITY_ERROR: Turnstile Site Key (VITE_TURNSTILE_SITE_KEY) is missing. Authentication protocol cannot initialize.");
  }

  const {
    user, loading, needsEmailVerification,
    signIn, signUp, signInWithGoogle, resetPassword, resendVerificationEmail,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<AuthMode>(
    searchParams.get("verify") === "required" ? "verification-notice" : "sign-in"
  );
  
  const [email, setEmail]           = useState("");
  const [fullname, setFullname]     = useState("");
  const [password, setPassword]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown]     = useState(false);
  const [mfaCode, setMfaCode]       = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");

  const [captchaSignIn, setCaptchaSignIn] = useState<CaptchaState>({ token: "", timestamp: 0, error: "", ready: false });
  const [captchaSignUp, setCaptchaSignUp] = useState<CaptchaState>({ token: "", timestamp: 0, error: "", ready: false });

  const turnstileSignInRef = useRef<TurnstileInstance>(null);
  const turnstileSignUpRef = useRef<TurnstileInstance>(null);

  useEffect(() => {
    if (!loading && user && !needsEmailVerification) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, loading, needsEmailVerification, navigate]);

  // ─── Captcha Handlers ────────────────────────────────────────────────────────
  const handleSignInSuccess = useCallback((token: string) => {
    setCaptchaSignIn({ token, timestamp: Date.now(), error: "", ready: true });
  }, []);

  const handleSignUpSuccess = useCallback((token: string) => {
    setCaptchaSignUp({ token, timestamp: Date.now(), error: "", ready: true });
  }, []);

  const handleSignInError = useCallback((code?: string) => {
    console.error("Turnstile SignIn Error:", code);
    setCaptchaSignIn(prev => ({ ...prev, token: "", error: "Security calibration failed (400020). Please reset.", ready: false }));
  }, []);

  const handleSignUpError = useCallback((code?: string) => {
    console.error("Turnstile SignUp Error:", code);
    setCaptchaSignUp(prev => ({ ...prev, token: "", error: "Security calibration failed (400020). Please reset.", ready: false }));
  }, []);

  const resetSignIn = useCallback(() => {
    turnstileSignInRef.current?.reset();
    setCaptchaSignIn({ token: "", timestamp: 0, error: "", ready: false });
  }, []);

  const resetSignUp = useCallback(() => {
    turnstileSignUpRef.current?.reset();
    setCaptchaSignUp({ token: "", timestamp: 0, error: "", ready: false });
  }, []);

  // ─── Business Logic ──────────────────────────────────────────────────────────
  const isSignInDisabled = submitting || cooldown || (!DISABLE_CAPTCHA && !captchaSignIn.token);
  const isSignUpDisabled = submitting || cooldown || (!DISABLE_CAPTCHA && !captchaSignUp.token);

  const validateTokenAge = (timestamp: number) => {
    return (Date.now() - timestamp) < TOKEN_EXPIRY_MS;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!DISABLE_CAPTCHA) {
      if (!captchaSignIn.token) {
        toast({ title: "Security check required", variant: "destructive" });
        return;
      }
      if (!validateTokenAge(captchaSignIn.timestamp)) {
        toast({ title: "Verification expired", description: "Security token stale. Automatically resetting...", variant: "destructive" });
        resetSignIn();
        return;
      }
    }

    setSubmitting(true);
    const token = captchaSignIn.token;
    
    // MANDATORY: Immediate invalidation/reset to prevent 110200 reuse
    resetSignIn();

    const { error } = await signIn(email, password, token || undefined);

    if (error) {
      setSubmitting(false);
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setMode("verification-notice");
      } else if (error.message.includes("110200") || error.message.toLowerCase().includes("captcha")) {
        setCaptchaSignIn(prev => ({ ...prev, error: "Verification expired or invalid (110200). Please retry." }));
        toast({ title: "Verification Failure", description: "The security check was rejected. Please try again.", variant: "destructive" });
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
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain || CONSUMER_DOMAINS.includes(domain)) {
      toast({ title: "Business email required", description: `@${domain || "unknown"} is not allowed.`, variant: "destructive" });
      return;
    }
    
    if (!DISABLE_CAPTCHA) {
      if (!captchaSignUp.token) {
        toast({ title: "Security check required", variant: "destructive" });
        return;
      }
      if (!validateTokenAge(captchaSignUp.timestamp)) {
        toast({ title: "Verification expired", description: "Security token stale. Automatically resetting...", variant: "destructive" });
        resetSignUp();
        return;
      }
    }

    setSubmitting(true);
    const token = captchaSignUp.token;
    
    // MANDATORY: Immediate invalidation/reset to prevent 110200 reuse
    resetSignUp();

    const { error } = await signUp(email, password, token || undefined);
    
    setSubmitting(false);
    if (error) {
      if (error.message.includes("110200") || error.message.toLowerCase().includes("captcha")) {
        setCaptchaSignUp(prev => ({ ...prev, error: "Verification expired or invalid (110200). Please retry." }));
      } else {
        toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      }
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
      toast({ title: "Reset link sent", description: "Check your email." });
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

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length < 6 || !mfaFactorId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode });
      if (error) toast({ title: "Invalid code", description: error.message, variant: "destructive" });
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
        <Loader2 className="h-6 w-6 animate-spin text-primary opacity-60" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 bg-background overflow-hidden">
      <AuroraBackground />

      <div className="w-full max-w-[420px] relative z-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Logo & Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-2xl backdrop-blur-md">
            <MushinLogo size={48} className="drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-[0.2em] text-white uppercase" style={{ fontFamily: "'Syne', sans-serif" }}>MUSHIN</h1>
            <p className="text-[10px] font-bold text-primary tracking-[0.3em] uppercase mt-1 opacity-80">無心 · Pure Clarity</p>
          </div>
        </div>

        {/* ── Stationary Turnstile Containers (NEVER UNMOUNTED) ──────────────── */}
        {!DISABLE_CAPTCHA && (mode === "sign-in" || mode === "sign-up") && (
          <div className="fixed opacity-0 pointer-events-none -z-50 overflow-hidden h-0 w-0">
             {/* Invisible but mounted to satisfy Cloudflare dimension checks and prevent 400020 */}
             <ManagedTurnstile 
              id="ts_signin_worker" 
              siteKey={TURN_SITE_KEY!} 
              onSuccess={handleSignInSuccess} 
              onExpire={() => setCaptchaSignIn(p => ({ ...p, ready: false }))} 
              onError={handleSignInError} 
              turnstileRef={turnstileSignInRef} 
            />
             <ManagedTurnstile 
              id="ts_signup_worker" 
              siteKey={TURN_SITE_KEY!} 
              onSuccess={handleSignUpSuccess} 
              onExpire={() => setCaptchaSignUp(p => ({ ...p, ready: false }))} 
              onError={handleSignUpError} 
              turnstileRef={turnstileSignUpRef} 
            />
          </div>
        )}

        {/* ── Verification Notice ─────────────────────────────────────────── */}
        {mode === "verification-notice" && (
          <GlassCard className="p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>Check your email</h2>
                <p className="text-xs font-medium text-white/40">{email || "your inbox"}</p>
              </div>
            </div>
            <p className="text-sm text-white/50 leading-relaxed text-center">We've sent a verification link. Please click it to activate your account, then return here to sign in.</p>
            <div className="flex flex-col gap-3 pt-2">
              <Button variant="outline" onClick={handleResend} disabled={submitting} className="w-full h-11 border-white/10 bg-white/[0.03] font-bold text-[10px] uppercase tracking-widest text-white/80">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Resend Verification
              </Button>
              <Button onClick={() => setMode("sign-in")} className="w-full h-11 btn-primary-alive font-bold text-[10px] uppercase tracking-widest">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Button>
            </div>
          </GlassCard>
        )}

        {/* ── MFA Challenge ──────────────────────────────────────────────── */}
        {mode === "mfa-challenge" && (
          <GlassCard className="p-8 space-y-6 shadow-2xl">
            <form onSubmit={handleMfaVerify} className="space-y-6">
              <button type="button" onClick={() => { setMode("sign-in"); supabase.auth.signOut(); }} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/70"><ArrowLeft size={12} /> Back to login</button>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center"><Shield className="h-5 w-5 text-primary" /></div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>Security Check</h2>
                  <p className="text-xs text-white/40">Enter the 6-digit authentication code</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Secure Code</Label>
                <Input type="text" inputMode="numeric" maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))} placeholder="000 000" required className="h-12 bg-white/[0.03] border-white/10 text-center text-xl tracking-[0.4em] font-black focus:border-primary/50" />
              </div>
              <Button type="submit" className="w-full h-12 btn-primary-alive font-bold text-[10px] uppercase tracking-widest" disabled={submitting || mfaCode.length !== 6}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Verify & Continue
              </Button>
            </form>
          </GlassCard>
        )}

        {/* ── Tabs & Forms ───────────────────────────────────────────────── */}
        {(mode === "sign-in" || mode === "sign-up") && (
          <div className="space-y-6">
            <div className="p-1 flex bg-black/40 border border-white/[0.05] rounded-2xl">
              <button onClick={() => setMode("sign-in")} className={`flex-1 h-10 rounded-xl transition-all duration-300 uppercase tracking-widest font-black text-[10px] ${mode === "sign-in" ? "bg-white/10 text-white shadow-lg" : "text-white/30 hover:text-white/50"}`}>Sign In</button>
              <button onClick={() => setMode("sign-up")} className={`flex-1 h-10 rounded-xl transition-all duration-300 uppercase tracking-widest font-black text-[10px] ${mode === "sign-up" ? "bg-white/10 text-white shadow-lg" : "text-white/30 hover:text-white/50"}`}>Sign Up</button>
            </div>

            <GlassCard className="p-8 space-y-6 shadow-2xl">
              {mode === "sign-in" ? (
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Work Email</Label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@business.pk" required className="h-12 bg-white/[0.03] border-white/10 focus:border-primary/40 font-medium" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Security Password</Label>
                        <button type="button" onClick={() => setMode("forgot-password")} className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary-foreground">Recover</button>
                      </div>
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="h-12 bg-white/[0.03] border-white/10 focus:border-primary/40 font-medium" />
                    </div>
                  </div>

                  {/* CAPTCHA Display (Visible in the actual form flow) */}
                  {!DISABLE_CAPTCHA && (
                    <div className="pt-2 min-h-[65px] flex flex-col justify-center">
                      <div className={captchaSignIn.token ? "opacity-0 h-0 pointer-events-none overflow-hidden" : "opacity-100 h-auto"}>
                         <div className="rounded-lg overflow-hidden border border-white/5 bg-white/[0.02]">
                            <ManagedTurnstile 
                              id="ts_signin_visible" 
                              siteKey={TURN_SITE_KEY!} 
                              onSuccess={handleSignInSuccess} 
                              onExpire={() => setCaptchaSignIn(p => ({ ...p, ready: false }))} 
                              onError={handleSignInError} 
                              turnstileRef={turnstileSignInRef} 
                            />
                         </div>
                      </div>
                      {captchaSignIn.token && !submitting && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase ml-1 animate-in fade-in zoom-in-95">
                          <Shield size={14} className="animate-pulse" /> Security Verified
                        </div>
                      )}
                      {captchaSignIn.error && (
                        <div className="flex items-start gap-2 text-[10px] text-destructive font-bold mt-2 ml-1 uppercase tracking-wider bg-destructive/10 p-2 rounded-md">
                          <AlertCircle size={14} className="shrink-0" /> {captchaSignIn.error}
                        </div>
                      )}
                    </div>
                  )}

                  <Button type="submit" className="w-full h-12 btn-primary-alive font-black text-[10px] uppercase tracking-widest" disabled={isSignInDisabled}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Access Dashboard →"}
                  </Button>

                  <div className="flex items-center gap-4 py-1">
                    <div className="h-px flex-1 bg-white/[0.05]" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/15">Authorized Org</span>
                    <div className="h-px flex-1 bg-white/[0.05]" />
                  </div>

                  <Button type="button" variant="outline" onClick={() => signInWithGoogle()} className="w-full h-12 border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-white/70 font-bold text-[10px] uppercase tracking-widest">
                    <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Identity
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Creator/Pro Name</Label>
                       <Input value={fullname} onChange={(e) => setFullname(e.target.value)} placeholder="Ahmad Shah" required className="h-12 bg-white/[0.03] border-white/10 focus:border-primary/40 font-medium" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Business Email</Label>
                       <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@business.pk" required className="h-12 bg-white/[0.03] border-white/10 focus:border-primary/40 font-medium" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Security Password</Label>
                       <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required className="h-12 bg-white/[0.03] border-white/10 focus:border-primary/40 font-medium" />
                    </div>
                  </div>

                  {!DISABLE_CAPTCHA && (
                    <div className="pt-2 min-h-[65px] flex flex-col justify-center">
                      <div className={captchaSignUp.token ? "opacity-0 h-0 pointer-events-none overflow-hidden" : "opacity-100 h-auto"}>
                         <div className="rounded-lg overflow-hidden border border-white/5 bg-white/[0.02]">
                            <ManagedTurnstile 
                              id="ts_signup_visible" 
                              siteKey={TURN_SITE_KEY!} 
                              onSuccess={handleSignUpSuccess} 
                              onExpire={() => setCaptchaSignUp(p => ({ ...p, ready: false }))} 
                              onError={handleSignUpError} 
                              turnstileRef={turnstileSignUpRef} 
                            />
                         </div>
                      </div>
                      {captchaSignUp.token && !submitting && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase ml-1 animate-in fade-in zoom-in-95">
                          <Shield size={14} className="animate-pulse" /> Security Verified
                        </div>
                      )}
                      {captchaSignUp.error && (
                        <div className="flex items-start gap-2 text-[10px] text-destructive font-bold mt-2 ml-1 uppercase tracking-wider bg-destructive/10 p-2 rounded-md">
                          <AlertCircle size={14} className="shrink-0" /> {captchaSignUp.error}
                        </div>
                      )}
                    </div>
                  )}

                  <Button type="submit" className="w-full h-12 btn-primary-alive font-black text-[10px] uppercase tracking-widest" disabled={isSignUpDisabled}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Initialize Org →"}
                  </Button>
                  <p className="text-[9px] text-white/20 text-center leading-relaxed px-4 uppercase tracking-tighter">By initializing, you confirm the <span className="text-white/40 font-bold hover:text-primary transition-colors cursor-pointer">Mushin Protocol</span> and Privacy Guard.</p>
                </form>
              )}
            </GlassCard>
            <p className="text-[10px] text-center font-bold text-white/20 uppercase tracking-[0.2em] animate-pulse">System Secure · CLOUDFLARE ARGO ENABLED</p>
          </div>
        )}

        {/* ── Forgot Password Form ────────────────────────────────────────── */}
        {mode === "forgot-password" && (
          <GlassCard className="p-8 space-y-6 shadow-2xl">
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <button type="button" onClick={() => setMode("sign-in")} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white/70"><ArrowLeft size={12} /> Back to Sign In</button>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center"><KeyRound className="h-5 w-5 text-primary" /></div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>Security Recovery</h2>
                  <p className="text-xs text-white/40">Secure verification link will be issued</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Recovery Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@business.pk" required className="h-12 bg-white/[0.03] border-white/10 focus:border-primary/40 font-medium" />
              </div>
              <Button type="submit" className="w-full h-12 btn-primary-alive font-black text-[10px] uppercase tracking-widest" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Issue Recovery Link"}</Button>
            </form>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
