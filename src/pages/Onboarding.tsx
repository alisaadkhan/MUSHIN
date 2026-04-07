import { useState } from "react";
import { SEO } from "@/components/SEO";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AuroraBackground } from "@/components/layout/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { MushinLogo } from "@/components/mushin-brand";

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

  if (profile?.onboarding_completed) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleComplete = async () => {
    if (!fullName.trim()) {
      toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
      setStep(1);
      return;
    }
    if (!profile?.id) {
      toast({ title: "Profile not ready", description: "Please wait a moment and try again.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), onboarding_completed: true, consent_given_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (profileErr) throw profileErr;

      if (workspace && (platform || useCase)) {
        const { data: wsData } = await supabase.from("workspaces").select("settings").eq("id", workspace.workspace_id).single();
        const currentSettings = (wsData?.settings as Record<string, unknown>) || {};
        const newSettings = {
          ...currentSettings,
          ...(platform && { primary_platform: platform.toLowerCase() }),
          ...(useCase && { use_case: useCase.toLowerCase().replace(/ /g, "_") }),
          ...(companyName.trim() && { company_name: companyName.trim() }),
        };
        await supabase.rpc("update_workspace_settings", { _workspace_id: workspace.workspace_id, _settings: newSettings });
      }
      await refreshProfile();
      navigate("/dashboard", { replace: true });
    } catch {
      toast({ title: "Error", description: "Failed to save. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <SEO title="Setup Your Account" description="Complete your MUSHIN account setup." noindex />
      <AuroraBackground />
      <div className="glass-card w-full max-w-lg p-8 space-y-6 relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center">
          <MushinLogo size={36} />
          <div className="text-center">
            <span className="text-lg font-extrabold tracking-[0.1em] text-foreground uppercase" style={{ fontFamily: "'Syne',sans-serif" }}>MUSHIN</span>
            <p className="text-[10px] text-primary tracking-widest">無心 · Pure Clarity</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${
              s === step ? "w-8 bg-primary glow-purple-sm" : s < step ? "w-2 bg-primary/50" : "w-2 bg-border"
            }`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne',sans-serif" }}>Welcome to MUSHIN</h1>
              <p className="text-muted-foreground text-sm">Let's set up your account in 3 quick steps</p>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Full name *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Company / Brand name</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Optional" className="mt-1.5" />
              </div>
            </div>
            <Button className="w-full btn-primary-alive" onClick={() => {
              if (!fullName.trim()) { toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" }); return; }
              setStep(2);
            }}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne',sans-serif" }}>Your preferences</h1>
              <p className="text-muted-foreground text-sm">Help us personalise your MUSHIN experience</p>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Primary platform</Label>
                <div className="grid grid-cols-3 gap-2">
                  {platforms.map((p) => (
                    <Button key={p} variant={platform === p ? "default" : "outline"} size="sm" onClick={() => setPlatform(p)} className="w-full">
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Primary use case</Label>
                <div className="grid grid-cols-1 gap-2">
                  {useCases.map((u) => (
                    <Button key={u} variant={useCase === u ? "default" : "outline"} size="sm" onClick={() => setUseCase(u)} className="w-full justify-start">
                      {u}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1 btn-primary-alive">Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne',sans-serif" }}>無心 — You're ready.</h1>
              <p className="text-muted-foreground text-sm">
                Your workspace is configured. Begin discovering verified Pakistani creators.
              </p>
            </div>
            <div className="glass-card p-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between"><span>Name</span><span className="text-foreground font-medium">{fullName}</span></div>
              {companyName && <div className="flex justify-between"><span>Company</span><span className="text-foreground font-medium">{companyName}</span></div>}
              {platform && <div className="flex justify-between"><span>Platform</span><span className="text-foreground font-medium">{platform}</span></div>}
              {useCase && <div className="flex justify-between"><span>Use case</span><span className="text-foreground font-medium">{useCase}</span></div>}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button onClick={handleComplete} disabled={saving} className="flex-1 btn-primary-alive">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {saving ? "Setting up…" : "Enter Dashboard →"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
