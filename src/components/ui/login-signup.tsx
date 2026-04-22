import * as React from "react";
import { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Github, Lock, Mail, ArrowRight } from "lucide-react";
import { Loader2 } from "lucide-react";

/** Small Google "G" colors (Lucide does not ship a Chrome icon in all versions). */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" aria-hidden width={16} height={16}>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

export interface LoginSignupSectionProps {
  /** Shell header label (default: MUSHIN) */
  brandName?: string;
  mode: "signin" | "signup";
  email: string;
  password: string;
  showPassword: boolean;
  rememberMe: boolean;
  loading: boolean;
  submitDisabled?: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onRememberMeChange: (checked: boolean) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onGoogleClick: () => void;
  onForgotPassword?: () => void;
  onSwitchToSignup?: () => void;
  onSwitchToSignin?: () => void;
  /** Sign-up only: Terms / Privacy blocks */
  signupLegal?: React.ReactNode;
  /** Turnstile / extra controls above primary submit */
  beforeSubmit?: React.ReactNode;
  title?: string;
  description?: string;
  /** Show GitHub SSO (disabled until wired) */
  showGithub?: boolean;
}

/**
 * Full-viewport login / sign-up shell (shadcn Card + particles).
 * Wire all handlers from {@link Auth} or another parent.
 */
export function LoginSignupSection({
  brandName = "MUSHIN",
  mode,
  email,
  password,
  showPassword,
  rememberMe,
  loading,
  submitDisabled = false,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onRememberMeChange,
  onSubmit,
  onGoogleClick,
  onForgotPassword,
  onSwitchToSignup,
  onSwitchToSignin,
  signupLegal,
  beforeSubmit,
  title,
  description,
  showGithub = false,
}: LoginSignupSectionProps) {
  const resolvedTitle =
    title ?? (mode === "signup" ? "Create account" : "Welcome back");
  const resolvedDescription =
    description ??
    (mode === "signup"
      ? "Agree to the policies, then set up your login."
      : "Sign in with your email and password.");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();

    type P = { x: number; y: number; v: number; o: number };
    let ps: P[] = [];
    let raf = 0;

    const make = (): P => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      v: Math.random() * 0.25 + 0.05,
      o: Math.random() * 0.35 + 0.15,
    });

    const init = () => {
      ps = [];
      const count = Math.floor((canvas.width * canvas.height) / 9000);
      for (let i = 0; i < count; i++) ps.push(make());
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of ps) {
        p.y -= p.v;
        if (p.y < 0) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + Math.random() * 40;
          p.v = Math.random() * 0.25 + 0.05;
          p.o = Math.random() * 0.35 + 0.15;
        }
        ctx.fillStyle = `rgba(250,250,250,${p.o})`;
        ctx.fillRect(p.x, p.y, 0.7, 2.2);
      }
      raf = requestAnimationFrame(draw);
    };

    const onResize = () => {
      setSize();
      init();
    };

    window.addEventListener("resize", onResize);
    init();
    raf = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="fixed inset-0 z-40 bg-zinc-950 text-zinc-50">
      <style>{`
        .accent-lines{position:absolute;inset:0;pointer-events:none;opacity:.7}
        .hline,.vline{position:absolute;background:#27272a;will-change:transform,opacity}
        .hline{left:0;right:0;height:1px;transform:scaleX(0);transform-origin:50% 50%;animation:drawX .8s cubic-bezier(.22,.61,.36,1) forwards}
        .vline{top:0;bottom:0;width:1px;transform:scaleY(0);transform-origin:50% 0%;animation:drawY .9s cubic-bezier(.22,.61,.36,1) forwards}
        .hline:nth-child(1){top:18%;animation-delay:.12s}
        .hline:nth-child(2){top:50%;animation-delay:.22s}
        .hline:nth-child(3){top:82%;animation-delay:.32s}
        .vline:nth-child(4){left:22%;animation-delay:.42s}
        .vline:nth-child(5){left:50%;animation-delay:.54s}
        .vline:nth-child(6){left:78%;animation-delay:.66s}
        .hline::after,.vline::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(250,250,250,.24),transparent);opacity:0;animation:shimmer .9s ease-out forwards}
        .hline:nth-child(1)::after{animation-delay:.12s}
        .hline:nth-child(2)::after{animation-delay:.22s}
        .hline:nth-child(3)::after{animation-delay:.32s}
        .vline:nth-child(4)::after{animation-delay:.42s}
        .vline:nth-child(5)::after{animation-delay:.54s}
        .vline:nth-child(6)::after{animation-delay:.66s}
        @keyframes drawX{0%{transform:scaleX(0);opacity:0}60%{opacity:.95}100%{transform:scaleX(1);opacity:.7}}
        @keyframes drawY{0%{transform:scaleY(0);opacity:0}60%{opacity:.95}100%{transform:scaleY(1);opacity:.7}}
        @keyframes shimmer{0%{opacity:0}35%{opacity:.25}100%{opacity:0}}
        .card-animate {
          opacity: 0;
          transform: translateY(20px);
          animation: fadeUp 0.8s cubic-bezier(.22,.61,.36,1) 0.4s forwards;
        }
        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(80%_60%_at_50%_30%,rgba(255,255,255,0.06),transparent_60%)]" />

      <div className="accent-lines">
        <div className="hline" />
        <div className="hline" />
        <div className="hline" />
        <div className="vline" />
        <div className="vline" />
        <div className="vline" />
      </div>

      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-50 mix-blend-screen"
      />

      <header className="absolute left-0 right-0 top-0 flex items-center justify-between border-b border-zinc-800/80 px-6 py-4">
        <span className="text-xs uppercase tracking-[0.14em] text-zinc-400">{brandName}</span>
        <Button variant="outline" className="h-9 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-50 hover:bg-zinc-900/80" asChild>
          <Link to="/pricing" className="inline-flex items-center">
            <span className="mr-2">Pricing</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </header>

      <div className="grid h-full w-full place-items-center px-4 pt-16">
        <Card className="card-animate w-full max-w-sm border-zinc-800 bg-zinc-900/70 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">{resolvedTitle}</CardTitle>
            <CardDescription className="text-zinc-400">{resolvedDescription}</CardDescription>
          </CardHeader>

          <form onSubmit={onSubmit}>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="auth-email" className="text-zinc-300">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    placeholder="you@example.com"
                    className="border-zinc-800 bg-zinc-950 pl-10 text-zinc-50 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="auth-password" className="text-zinc-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    id="auth-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                    maxLength={128}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    placeholder="••••••••"
                    className="border-zinc-800 bg-zinc-950 py-2 pl-10 pr-10 text-zinc-50 placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-zinc-400 hover:text-zinc-200"
                    onClick={onTogglePassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === "signup" && signupLegal}

              {mode === "signin" ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(c) => onRememberMeChange(c === true)}
                      className="border-zinc-700 data-[state=checked]:bg-zinc-50 data-[state=checked]:text-zinc-900"
                    />
                    <Label htmlFor="remember" className="text-zinc-400">
                      Remember me
                    </Label>
                  </div>
                  {onForgotPassword && (
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      className="text-sm text-zinc-300 hover:text-zinc-100"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember-su"
                    checked={rememberMe}
                    onCheckedChange={(c) => onRememberMeChange(c === true)}
                    className="border-zinc-700 data-[state=checked]:bg-zinc-50 data-[state=checked]:text-zinc-900"
                  />
                  <Label htmlFor="remember-su" className="text-zinc-400">
                    Remember me on this device
                  </Label>
                </div>
              )}

              {beforeSubmit}

              <Button
                type="submit"
                disabled={loading || submitDisabled}
                className="h-10 w-full rounded-lg bg-zinc-50 text-zinc-900 hover:bg-zinc-200"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "signup" ? (
                  "Create account"
                ) : (
                  "Sign in"
                )}
              </Button>

              <div className="relative">
                <Separator className="bg-zinc-800" />
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-900/70 px-2 text-[11px] uppercase tracking-widest text-zinc-500">
                  or
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 flex-1 rounded-lg border-zinc-800 bg-zinc-950 text-zinc-50 hover:bg-zinc-900/80"
                  onClick={onGoogleClick}
                  disabled={loading}
                >
                  <GoogleGlyph className="mr-2 h-4 w-4" />
                  Google
                </Button>
                {showGithub && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 flex-1 rounded-lg border-zinc-800 bg-zinc-950 text-zinc-50 hover:bg-zinc-900/80"
                    disabled
                    title="GitHub sign-in is not configured"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    GitHub
                  </Button>
                )}
              </div>
            </CardContent>
          </form>

          <CardFooter className="flex flex-col items-center gap-3 text-sm text-zinc-400">
            {mode === "signin" ? (
              <p>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={onSwitchToSignup}
                  className="text-zinc-200 underline-offset-4 hover:text-white hover:underline"
                >
                  Create one
                </button>
              </p>
            ) : (
              <p>
                Already registered?{" "}
                <button
                  type="button"
                  onClick={onSwitchToSignin}
                  className="text-zinc-200 underline-offset-4 hover:text-white hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-4 text-[11px] text-zinc-500">
              <Link to="/terms" className="hover:text-zinc-300">
                Terms
              </Link>
              <Link to="/privacy" className="hover:text-zinc-300">
                Privacy
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}

/** @deprecated Use {@link LoginSignupSection} — alias for pasted demo name */
export const LoginCardSection = LoginSignupSection;

export default LoginSignupSection;
