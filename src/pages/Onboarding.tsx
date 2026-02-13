import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AuroraBackground } from "@/components/layout/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, Zap } from "lucide-react";

const platforms = ["Instagram", "TikTok", "YouTube"] as const;
const useCases = ["Brand partnerships", "Talent management", "Market research"] as const;

export default function Onboarding() {
  const { profile, workspace, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [companyName, setCompanyName] = useState("");
  const [platform, setPlatform] = useState<string>("");
  const [useCase, setUseCase] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Guard: already completed
  if (profile?.onboarding_completed) {
    return <Navigate to="/" replace />;
  }

  const handleComplete = async () => {
    if (!fullName.trim()) {
      toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
      setStep(1);
      return;
    }

    setSaving(true);
    try {
      // Update profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), onboarding_completed: true, consent_given_at: new Date().toISOString() })
        .eq("id", profile!.id);

      if (profileErr) throw profileErr;

      // Merge workspace settings
      if (workspace && (platform || useCase)) {
        const { data: wsData } = await supabase
          .from("workspaces")
          .select("settings")
          .eq("id", workspace.workspace_id)
          .single();

        const currentSettings = (wsData?.settings as Record<string, unknown>) || {};
        const newSettings = {
          ...currentSettings,
          ...(platform && { primary_platform: platform.toLowerCase() }),
          ...(useCase && { use_case: useCase.toLowerCase().replace(/ /g, "_") }),
          ...(companyName.trim() && { company_name: companyName.trim() }),
        };

        await supabase
          .from("workspaces")
          .update({ settings: newSettings })
          .eq("id", workspace.workspace_id);
      }

      await refreshProfile();
      navigate("/", { replace: true });
    } catch {
      toast({ title: "Error", description: "Failed to save. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <AuroraBackground />

      <div className="glass-card w-full max-w-lg p-8 space-y-6 relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="aurora-text">Influence</span>
            <span className="text-foreground">IQ</span>
          </span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-8 bg-primary" : s < step ? "w-2 bg-primary/60" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Welcome to InfluenceIQ</h1>
              <p className="text-muted-foreground text-sm">Let's set up your account</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company / Brand name</Label>
                <Input
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
            <Button className="w-full" onClick={() => {
              if (!fullName.trim()) {
                toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
                return;
              }
              setStep(2);
            }}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Preferences */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Your preferences</h1>
              <p className="text-muted-foreground text-sm">Help us personalize your experience</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Primary platform</Label>
                <div className="grid grid-cols-3 gap-2">
                  {platforms.map((p) => (
                    <Button
                      key={p}
                      variant={platform === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPlatform(p)}
                      className="w-full"
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Primary use case</Label>
                <div className="grid grid-cols-1 gap-2">
                  {useCases.map((u) => (
                    <Button
                      key={u}
                      variant={useCase === u ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseCase(u)}
                      className="w-full"
                    >
                      {u}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-accent mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">You're all set!</h1>
              <p className="text-muted-foreground text-sm">Your account is ready. Let's get started.</p>
            </div>
            <Button className="w-full btn-shine" onClick={handleComplete} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
