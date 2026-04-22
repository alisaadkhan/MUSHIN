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
import { Separator } from "@/components/ui/separator";
import { Mail, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

export interface ForgotPasswordSectionProps {
  brandName?: string;
  email: string;
  loading: boolean;
  submitted: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onBackToLogin: () => void;
  onCreateAccount: () => void;
}

/**
 * Full-viewport forgot-password shell (matches `login-signup` visuals).
 */
export function ForgotPasswordSection({
  brandName = "MUSHIN",
  email,
  loading,
  submitted,
  onEmailChange,
  onSubmit,
  onBackToLogin,
  onCreateAccount,
}: ForgotPasswordSectionProps) {
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
        .card-animate {
          opacity: 0;
          transform: translateY(20px);
          animation: fadeUp .8s cubic-bezier(.22,.61,.36,1) .4s forwards;
        }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
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
        @keyframes drawX{0%{transform:scaleX(0);opacity:0}60%{opacity:.95}100%{transform:scaleX(1);opacity:.7}}
        @keyframes drawY{0%{transform:scaleY(0);opacity:0}60%{opacity:.95}100%{transform:scaleY(1);opacity:.7}}
      `}</style>

      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-50 mix-blend-screen"
      />

      <div className="accent-lines">
        <div className="hline" />
        <div className="hline" />
        <div className="hline" />
        <div className="vline" />
        <div className="vline" />
        <div className="vline" />
      </div>

      <header className="absolute left-0 right-0 top-0 flex items-center justify-between border-b border-zinc-800/80 px-6 py-4">
        <span className="text-xs uppercase tracking-[0.14em] text-zinc-400">{brandName}</span>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-lg border-zinc-800 bg-zinc-900 text-zinc-50 hover:bg-zinc-900/80"
          onClick={onBackToLogin}
        >
          <span className="mr-2">Back</span>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </header>

      <div className="grid h-full w-full place-items-center px-4 pt-16">
        <Card className="card-animate w-full max-w-sm border-zinc-800 bg-zinc-900/70 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/60">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Forgot password?</CardTitle>
            <CardDescription className="text-zinc-400">
              Enter your email and we&apos;ll send you a reset link if an account exists.
            </CardDescription>
          </CardHeader>

          <form onSubmit={onSubmit}>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="forgot-email" className="text-zinc-300">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <Input
                    id="forgot-email"
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

              <Button
                type="submit"
                disabled={loading || submitted}
                className="h-10 w-full rounded-lg bg-zinc-50 text-zinc-900 hover:bg-zinc-200"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Send reset link
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              {submitted && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-300">
                  If an account exists for this email, we sent a reset link. Check spam if you don&apos;t see it.
                </div>
              )}

              <div className="relative">
                <Separator className="bg-zinc-800" />
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-900/70 px-2 text-[11px] uppercase tracking-widest text-zinc-500">
                  or
                </span>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="text-left text-sm text-zinc-300 hover:text-zinc-100"
                >
                  Back to log in
                </button>
                <button
                  type="button"
                  onClick={onCreateAccount}
                  className="text-left text-sm text-zinc-300 hover:text-zinc-100"
                >
                  Create a new account
                </button>
              </div>
            </CardContent>
          </form>

          <CardFooter className="flex justify-center text-[11px] text-zinc-500">
            <Link to="/terms" className="hover:text-zinc-300">
              Terms
            </Link>
            <span className="mx-2">·</span>
            <Link to="/privacy" className="hover:text-zinc-300">
              Privacy
            </Link>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
}

export default ForgotPasswordSection;
