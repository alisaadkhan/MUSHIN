import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuroraBackground } from "@/components/layout/AuroraBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function UpdatePassword() {
  const { updatePassword, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requireOld = location.state?.requireOld === true;
  
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireOld && !currentPassword) {
      toast({ title: "Current password required", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Minimum 8 characters.", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    
    if (requireOld && user?.email) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        setLoading(false);
        toast({ title: "Invalid current password", description: "Please ensure your original password is correct.", variant: "destructive" });
        return;
      }
    }

    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated", description: "You can now sign in with your new password." });
      navigate("/admin");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <AuroraBackground />
      <div className="glass-card w-full max-w-sm p-8 space-y-6 relative z-10">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Syne',sans-serif" }}>Set new password</h1>
          <p className="text-sm text-muted-foreground text-center">Choose a strong password for your MUSHIN account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {requireOld && (
            <div>
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Original Password</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className="mt-1.5" required />
            </div>
          )}
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">New Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5" required />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirm Password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className="mt-1.5" required />
          </div>
          <Button type="submit" className="w-full btn-primary-alive" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
}
