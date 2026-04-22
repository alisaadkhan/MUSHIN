import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { consumePasswordAuthSlot } from "@/lib/authRateLimit";
import { toast } from "@/hooks/use-toast";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { authRememberMe } from "@/integrations/supabase/client";
import { LoginSignupSection } from "@/components/ui/login-signup";
import { ForgotPasswordSection } from "@/components/ui/forgot-password-section";

const ACCENT_LINK = "text-blue-400 hover:text-blue-300";

const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_DISABLE_CAPTCHA === "true" ? "" : (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "");

function clampInput(email: string, password: string) {
  return {
    email: email.trim().slice(0, 254),
    password: password.slice(0, 128),
  };
}

export default function Auth() {
  const location = useLocation();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(
    location.pathname === "/signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => authRememberMe.get());
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/signup") setMode("signup");
    else if (location.pathname === "/login") setMode("signin");
  }, [location.pathname]);

  useEffect(() => {
    if (mode !== "forgot") setForgotSubmitted(false);
  }, [mode]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    turnstileRef.current?.reset();
    setCaptchaToken("");
    setCaptchaError("");
    setCaptchaVerified(false);
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let ok = false;

    const { email: em, password: pw } = clampInput(email, password);
    if (!em.includes("@") || em.length < 3) {
      setLoading(false);
      toast({ title: "Invalid email", description: "Enter a valid email address.", variant: "destructive" });
      return;
    }

    try {
      authRememberMe.set(rememberMe);

      if (TURNSTILE_SITE_KEY && mode !== "forgot" && !captchaToken) {
        throw new Error("Complete the security check first.");
      }

      if (mode === "forgot") {
        const gate = await consumePasswordAuthSlot();
        if (!gate.ok) throw new Error(gate.message);
        const { error } = await resetPassword(em);
        if (error) throw error;
        setForgotSubmitted(true);
        toast({
          title: "Check your email",
          description: "If an account exists for this address, we sent a reset link.",
        });
        return;
      }

      if (mode === "signup") {
        if (!acceptedTerms || !acceptedPrivacy) {
          throw new Error("Confirm that you agree to the Terms and Privacy Policy.");
        }
        const now = new Date().toISOString();
        const { error, session } = await signUp(em, pw, {
          captchaToken: captchaToken || undefined,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
        });
        if (error) throw error;
        if (session) {
          toast({ title: "Welcome", description: "You are signed in." });
          navigate("/dashboard", { replace: true });
          return;
        }
        toast({
          title: "Confirm your email",
          description: "We sent a link to your inbox. After you confirm, you can sign in and open the dashboard.",
        });
        return;
      }

      const { error } = await signIn(em, pw, captchaToken || undefined);
      if (error) throw error;
      ok = true;
      navigate("/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast({
        title: mode === "signin" ? "Sign in failed" : mode === "signup" ? "Sign up failed" : "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      // Only reset the captcha when the attempt failed; on success, keep the "verified" UI.
      if (TURNSTILE_SITE_KEY && !ok) {
        turnstileRef.current?.reset();
        setCaptchaToken("");
        setCaptchaVerified(false);
      }
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (mode === "signup" && (!acceptedTerms || !acceptedPrivacy)) {
      toast({
        title: "Terms required",
        description: "Agree to the Terms and Privacy Policy before continuing with Google.",
        variant: "destructive",
      });
      return;
    }
    if (mode === "signup") {
      const now = new Date().toISOString();
      try {
        sessionStorage.setItem("oauth_legal", JSON.stringify({ terms: now, privacy: now }));
      } catch {
        /* ignore */
      }
    }
    setLoading(true);
    await signInWithGoogle();
    setLoading(false);
  };

  const signupBlocked =
    mode === "signup" &&
    (!acceptedTerms || !acceptedPrivacy || (TURNSTILE_SITE_KEY && !captchaToken));

  const signupLegal =
    mode === "signup" ? (
      <div className="space-y-3 pt-1 text-[13px] leading-relaxed text-zinc-400">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border border-zinc-600 bg-zinc-950 accent-zinc-50"
          />
          <span>
            I agree to the{" "}
            <Link to="/terms" target="_blank" rel="noopener noreferrer" className={ACCENT_LINK}>
              Terms of Service
            </Link>
            .
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={acceptedPrivacy}
            onChange={(e) => setAcceptedPrivacy(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border border-zinc-600 bg-zinc-950 accent-zinc-50"
          />
          <span>
            I agree to the{" "}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer" className={ACCENT_LINK}>
              Privacy Policy
            </Link>
            .
          </span>
        </label>
      </div>
    ) : null;

  const turnstileBlock =
    !!TURNSTILE_SITE_KEY && mode !== "forgot" ? (
      <div className="space-y-2 pt-1">
        {captchaVerified && captchaToken && (
          <div className="flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-200">
            <span>Security check complete</span>
            <button
              type="button"
              className="text-emerald-200/80 hover:text-emerald-100 underline underline-offset-4"
              onClick={() => {
                turnstileRef.current?.reset();
                setCaptchaToken("");
                setCaptchaError("");
                setCaptchaVerified(false);
              }}
            >
              Re-verify
            </button>
          </div>
        )}
        {!captchaToken && !captchaError && (
          <div className="h-[65px] rounded-md border border-zinc-800 bg-zinc-950/80" />
        )}
        <div
          aria-hidden={!!captchaToken}
          style={
            captchaToken
              ? { position: "absolute", opacity: 0, pointerEvents: "none", height: 0, overflow: "hidden" }
              : undefined
          }
        >
          <Turnstile
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            onSuccess={(token) => {
              setCaptchaToken(token);
              setCaptchaError("");
              setCaptchaVerified(true);
            }}
            onExpire={() => {
              setCaptchaToken("");
              setCaptchaVerified(false);
            }}
            onError={(code) => {
              setCaptchaToken("");
              setCaptchaVerified(false);
              setCaptchaError(
                code ? `Security check failed (${code}). Try again.` : "Security check failed. Try again.",
              );
            }}
            onUnsupported={() => {
              setCaptchaToken("");
              setCaptchaVerified(false);
              setCaptchaError("Security check is not supported in this browser.");
            }}
            options={{ theme: "dark", size: "normal" }}
          />
        </div>
        {captchaError && <div className="text-[11px] text-red-400 leading-relaxed">{captchaError}</div>}
      </div>
    ) : null;

  if (mode === "forgot") {
    return (
      <ForgotPasswordSection
        email={email}
        loading={loading}
        submitted={forgotSubmitted}
        onEmailChange={setEmail}
        onSubmit={handleSubmit}
        onBackToLogin={() => {
          setMode("signin");
          setForgotSubmitted(false);
        }}
        onCreateAccount={() => setMode("signup")}
      />
    );
  }

  return (
    <LoginSignupSection
      mode={mode}
      email={email}
      password={password}
      showPassword={showPw}
      rememberMe={rememberMe}
      loading={loading}
      submitDisabled={signupBlocked}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onTogglePassword={() => setShowPw((v) => !v)}
      onRememberMeChange={setRememberMe}
      onSubmit={handleSubmit}
      onGoogleClick={handleGoogle}
      onForgotPassword={() => setMode("forgot")}
      onSwitchToSignup={() => setMode("signup")}
      onSwitchToSignin={() => setMode("signin")}
      signupLegal={signupLegal}
      beforeSubmit={
        <>
          {turnstileBlock}
          {signupBlocked && mode === "signup" && (
            <p className="text-[11px] text-amber-200/90">
              Accept the Terms and Privacy Policy
              {TURNSTILE_SITE_KEY ? " and complete the security check" : ""} to continue.
            </p>
          )}
        </>
      }
    />
  );
}
