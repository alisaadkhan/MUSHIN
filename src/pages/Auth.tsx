import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuroraBackground } from "@/components/layout/AuroraBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Zap, Loader2, Mail, ArrowLeft } from "lucide-react";

type AuthMode = "sign-in" | "sign-up" | "forgot-password" | "verification-notice";

export default function Auth() {
  const { user, loading, needsEmailVerification, signIn, signUp, signInWithGoogle, resetPassword, resendVerificationEmail } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<AuthMode>(
    searchParams.get("verify") === "required" ? "verification-notice" : "sign-in"
  );
  const [email, setEmail] = useState("");
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
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <AuroraBackground />

      <div className="glass-card w-full max-w-md space-y-6 p-8 relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            <span className="aurora-text">Influence</span>
            <span className="text-foreground">IQ</span>
          </span>
        </div>

        {/* Sign In */}
        {mode === "sign-in" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">Welcome back</h2>
              <p className="text-sm text-muted-foreground mt-1">Sign in to your InfluenceIQ account</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full btn-shine" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <span className="relative bg-background px-3 text-xs text-muted-foreground">or continue with</span>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={submitting}>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-primary hover:underline" onClick={() => setMode("forgot-password")}>
                Forgot password?
              </button>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("sign-up")}>
                Don't have an account? <span className="text-primary">Sign up</span>
              </button>
            </div>
          </form>
        )}

        {/* Sign Up */}
        {mode === "sign-up" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">Create your account</h2>
              <p className="text-sm text-muted-foreground mt-1">Join InfluenceIQ to discover top creators</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullname">Full Name</Label>
              <Input id="fullname" type="text" placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full btn-shine" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Account
            </Button>
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <span className="relative bg-background px-3 text-xs text-muted-foreground">or continue with</span>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={submitting}>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </Button>
            <div className="text-center text-sm">
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setMode("sign-in")}>
                Already have an account? <span className="text-primary">Sign in</span>
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password */}
        {mode === "forgot-password" && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <button type="button" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("sign-in")}>
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </button>
            <h2 className="text-center text-lg font-semibold text-foreground">Reset your password</h2>
            <p className="text-center text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <Button type="submit" className="w-full btn-shine" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send Reset Link
            </Button>
          </form>
        )}

        {/* Verification Notice */}
        {mode === "verification-notice" && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              We sent a verification link to <span className="font-medium text-foreground">{email || "your email"}</span>. Please verify your account before signing in.
            </p>
            <Button variant="outline" className="w-full" onClick={handleResend} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Resend Verification Email
            </Button>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode("sign-in")}>
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
