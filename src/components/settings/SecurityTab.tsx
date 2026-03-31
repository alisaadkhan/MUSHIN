import React, { useState } from "react";
import { Lock, Shield, Monitor, AlertCircle, QrCode, Loader2, CheckCircle2, RefreshCw, X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SecurityTabProps {
  user: any;
  updatePassword: (password: string) => Promise<{ error: any }>;
  mfaFactors: any;
  refetchMfa: () => Promise<any>;
}

export function SecurityTab({ user, updatePassword, mfaFactors, refetchMfa }: SecurityTabProps) {
  const { toast } = useToast();
  
  // Password states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  // MFA states
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [mfaEnrollData, setMfaEnrollData] = useState<{ factorId: string; qrCodeUrl: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isMfaVerifying, setIsMfaVerifying] = useState(false);

  // Session states
  const [isSigningOutOthers, setIsSigningOutOthers] = useState(false);

  const totpFactor = mfaFactors?.totp?.find((f: any) => f.status === "verified");
  const twoFAEnabled = !!totpFactor;

  const handlePasswordUpdate = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Weak password", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setIsPasswordSaving(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      toast({ title: "Password updated" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handleEnable2FA = async () => {
    setIsMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setMfaEnrollData({ factorId: data.id, qrCodeUrl: data.totp.qr_code, secret: data.totp.secret });
    } catch (err: any) {
      toast({ title: "Enrolling MFA failed", description: err.message, variant: "destructive" });
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!mfaEnrollData || mfaCode.length < 6) return;
    setIsMfaVerifying(true);
    try {
      const { error } = await supabase.auth.challengeAndVerify({ factorId: mfaEnrollData.factorId, code: mfaCode });
      if (error) throw error;
      toast({ title: "2FA Protocol Enabled", description: "Session security hardened." });
      setMfaEnrollData(null);
      setMfaCode("");
      await refetchMfa();
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setIsMfaVerifying(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!totpFactor) return;
    setIsMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) throw error;
      toast({ title: "2FA Protocol Disabled" });
      await refetchMfa();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleSignOutOthers = async () => {
    setIsSigningOutOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast({ title: "External sessions revoked" });
    } catch (err: any) {
      toast({ title: "Revocation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSigningOutOthers(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Key Access ─── */}
      <GlassCard intensity="low" className="p-8 md:p-10 space-y-10">
        <div>
           <h2 className="text-xl font-black text-white uppercase tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>Cryptography Matrix</h2>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">Manage encryption and access keys</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">New Access Key (Password)</label>
              <Input 
                type="password"
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="At least 8 bits" 
                className="h-11 bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[13px] font-black tracking-widest"
              />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Verify Key</label>
              <Input 
                type="password"
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                placeholder="Repeat key" 
                className="h-11 bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[13px] font-black tracking-widest"
              />
           </div>
        </div>
        <div className="pt-6 border-t border-white/[0.05] flex justify-end">
          <Button 
            className="h-11 px-10 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest shadow-xl" 
            onClick={handlePasswordUpdate} 
            disabled={isPasswordSaving || newPassword.length < 8 || newPassword !== confirmPassword}
          >
            {isPasswordSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Rotate Access Key
          </Button>
        </div>
      </GlassCard>

      {/* ── Multi-Factor Protocol ─── */}
      <GlassCard intensity="low" className="p-8 md:p-10 space-y-8 relative overflow-hidden">
        <div className="flex items-center justify-between">
           <div className="space-y-1">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>MFA Safeguard</h3>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">Binary verification challenge (TOTP)</p>
           </div>
           <div className="flex items-center gap-4">
              {twoFAEnabled && (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-black text-[9px] uppercase tracking-widest px-2 py-1">
                  <Shield size={10} className="mr-1.5" /> Synchronized
                </Badge>
              )}
              <Switch checked={twoFAEnabled} onCheckedChange={twoFAEnabled ? handleDisable2FA : handleEnable2FA} disabled={isMfaLoading} />
           </div>
        </div>

        {mfaEnrollData && (
          <div className="border border-white/10 rounded-2xl p-6 space-y-8 bg-white/[0.01] animate-in zoom-in-95 duration-300">
             <div className="flex flex-col sm:flex-row items-center gap-10">
                <div className="p-4 bg-white rounded-2xl border border-white/10 shadow-2xl">
                   <img src={mfaEnrollData.qrCodeUrl} alt="2FA" className="w-32 h-32" />
                </div>
                <div className="flex-1 space-y-6">
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Cluster Recovery Hex</p>
                      <code className="text-[11px] font-mono bg-white/5 px-3 py-1.5 rounded-lg text-purple-400 break-all select-all border border-white/5">{mfaEnrollData.secret}</code>
                   </div>
                   <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-widest text-white/80">Input 6-Digit Signal</label>
                      <div className="flex gap-3">
                         <Input 
                           maxLength={6} 
                           value={mfaCode} 
                           onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))} 
                           placeholder="000 000" 
                           className="w-32 h-12 bg-white/[0.02] border-white/10 text-[18px] font-black tracking-[0.5em] text-center"
                         />
                         <Button onClick={handleVerify2FA} disabled={mfaCode.length < 6 || isMfaVerifying} className="h-12 flex-1 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest">
                           {isMfaVerifying && <Loader2 size={14} className="mr-2 animate-spin" />}
                           Verify Link
                         </Button>
                      </div>
                   </div>
                </div>
             </div>
             <Button variant="ghost" className="text-white/20 hover:text-white" onClick={() => setMfaEnrollData(null)}>Abort MFA Initialization</Button>
          </div>
        )}
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-500/[0.01] rounded-full blur-[100px] pointer-events-none" />
      </GlassCard>

      {/* ── Active Sessions Cluster ─── */}
      <GlassCard intensity="low" className="p-8 md:p-10 space-y-8">
        <div>
           <h3 className="text-lg font-black text-white uppercase tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>Session Uplinks</h3>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">Authorized terminal connections</p>
        </div>
        <div className="border border-white/5 rounded-2xl p-6 bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors border-l-2 border-l-purple-500/40">
           <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                 <Monitor size={20} />
              </div>
              <div>
                 <div className="flex items-center gap-3">
                    <p className="text-sm font-black text-white tracking-widest uppercase">Primary Terminal</p>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black uppercase tracking-widest">Active</Badge>
                 </div>
                 <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1.5">{user?.email}</p>
              </div>
           </div>
           <Button variant="outline" className="text-red-400 border-red-400/20 hover:bg-red-400/10 text-[9px] font-black uppercase tracking-widest h-10 px-6 shadow-xl" onClick={handleSignOutOthers} disabled={isSigningOutOthers}>
             {isSigningOutOthers && <Loader2 size={12} className="mr-2 animate-spin" />}
             Revoke External Uplinks
           </Button>
        </div>

        <div className="flex items-start gap-4 p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
           <AlertCircle size={16} className="text-amber-500/40 mt-0.5 flex-shrink-0" />
           <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/20 leading-relaxed">
             Executing revocation terminates all active sessions except the currently active terminal node. This action is instantaneous and cannot be reversed.
           </p>
        </div>
      </GlassCard>
    </div>
  );
}

const cn = (...args: any[]) => args.filter(Boolean).join(" ");
