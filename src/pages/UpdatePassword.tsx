import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuroraBackground } from "@/components/layout/AuroraBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Zap, Loader2, Lock, Eye, EyeOff, Check } from "lucide-react";

export default function UpdatePassword() {
  const { updatePassword, user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirm && password.length > 0;
  const isFormValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      toast({ title: "Please meet all password requirements", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      navigate("/", { replace: true });
    }
  };

  if (!user) {
    navigate("/auth", { replace: true });
    return null;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <AuroraBackground />
      <div className="glass-card w-full max-w-md space-y-6 p-8 relative z-10">
        <div className="flex flex-col items-center justify-center gap-2 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight mt-2">
            <span className="aurora-text">Influence</span>
            <span className="text-foreground">IQ</span>
          </span>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-foreground">Update password</h2>
          <p className="text-sm text-muted-foreground mt-1">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="pl-9 pr-10 h-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                className="pl-9 h-10"
              />
            </div>
          </div>

          <ul className="space-y-1.5 text-xs py-2">
            {[
              { label: "At least 8 characters", valid: hasMinLength },
              { label: "One uppercase letter", valid: hasUppercase },
              { label: "One number", valid: hasNumber },
              { label: "Passwords match", valid: passwordsMatch },
            ].map((rule) => (
              <li key={rule.label} className={`flex items-center gap-2 ${rule.valid ? "text-primary font-medium" : "text-muted-foreground"}`}>
                <Check className={`h-3.5 w-3.5 ${rule.valid ? "opacity-100" : "opacity-40"}`} />
                {rule.label}
              </li>
            ))}
          </ul>

          <Button type="submit" className="w-full btn-shine h-10" disabled={!isFormValid || submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
}
