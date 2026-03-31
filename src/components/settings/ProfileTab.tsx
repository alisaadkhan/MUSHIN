import React, { useRef, useState, useEffect } from "react";
import { Camera, Mail, Loader2, User } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProfileTabProps {
  user: any;
  profile: any;
  refreshProfile: () => Promise<void>;
}

export function ProfileTab({ user, profile, refreshProfile }: ProfileTabProps) {
  const { toast } = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      const parts = profile.full_name.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 1024 * 1024) {
      toast({ title: "File too large", description: "Avatar must be under 1 MB.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const cacheBusted = `${publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: cacheBusted })
        .eq("id", user.id);
      if (dbErr) throw dbErr;
      setAvatarUrl(cacheBusted);
      await refreshProfile();
      toast({ title: "Avatar updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || null;
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, avatar_url: avatarUrl.trim() || null })
        .eq("id", user!.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Profile updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";

  return (
    <GlassCard intensity="low" className="p-8 md:p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h2 className="text-xl font-black text-white uppercase tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>User Node Identity</h2>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">Operational profile management</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative group">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-2xl object-cover border border-white/10 group-hover:border-purple-500/30 transition-colors shadow-2xl" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-xl font-black text-white/40 group-hover:text-purple-400 group-hover:border-purple-500/30 transition-all">{initials}</div>
            )}
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            <button 
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-2 -right-2 p-1.5 rounded-lg bg-[#0c0c14] border border-white/10 text-white/40 hover:text-purple-400 hover:border-purple-500/30 transition-all shadow-xl"
              disabled={isUploading}
            >
              {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </button>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-white/80">Vector: {user?.email}</p>
            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1">System Authorization Level: OPERATOR</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-2">
           <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">First Name (Initial)</label>
           <Input 
             value={firstName} 
             onChange={(e) => setFirstName(e.target.value)} 
             placeholder="John" 
             className="h-11 bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[13px] font-black uppercase tracking-widest"
           />
        </div>
        <div className="space-y-2">
           <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Last Name (Vector)</label>
           <Input 
             value={lastName} 
             onChange={(e) => setLastName(e.target.value)} 
             placeholder="Doe" 
             className="h-11 bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[13px] font-black uppercase tracking-widest"
           />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Authentication Mailbox</label>
        <div className="relative">
          <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
          <Input 
            value={user?.email || ""} 
            disabled 
            className="h-11 pl-12 bg-white/[0.01] border-white/5 text-[12px] font-bold text-white/20 cursor-not-allowed uppercase tracking-widest"
          />
        </div>
        <p className="text-[9px] font-bold text-white/10 uppercase tracking-widest mt-2 px-1">Node relocation requires protocol supervisor approval.</p>
      </div>

      <div className="pt-6 border-t border-white/[0.05] flex justify-end">
        <Button 
          className="h-11 px-10 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95" 
          onClick={handleSave} 
          disabled={isSaving}
        >
          {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Commit Changes
        </Button>
      </div>
    </GlassCard>
  );
}
