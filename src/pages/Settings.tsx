import { useState, useEffect, useRef } from "react";
import { User, Globe, Lock, Zap, Mail, Trash2, Camera, Monitor, Loader2, Shield, UserPlus, QrCode, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { EmailTemplateManager } from "@/components/campaigns/EmailTemplateManager";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { DataManagement } from "@/components/settings/DataManagement";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const tabs = [
  { label: "Profile", icon: User },
  { label: "Workspace", icon: Globe },
  { label: "Integrations", icon: Zap },
  { label: "Security", icon: Lock },
];

export default function Settings() {
  const { user, profile, workspace, updatePassword, refreshProfile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("Profile");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ── Profile ──────────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      const parts = profile.full_name.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
  }, [profile]);

  // ── Security ─────────────────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Real MFA state
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaEnrollData, setMfaEnrollData] = useState<{ factorId: string; qrCodeUrl: string; secret: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const { data: mfaFactors, refetch: refetchMfa } = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });

  const totpFactor = mfaFactors?.totp?.find((f: any) => f.status === "verified");
  const twoFAEnabled = !!totpFactor;

  // Sessions
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  // ── Outreach ──────────────────────────────────────────────────────────────
  const [defaultFromName, setDefaultFromName] = useState("");
  const [defaultReplyTo, setDefaultReplyTo] = useState("");
  const [outreachSaving, setOutreachSaving] = useState(false);

  // ── Invite member dialog ──────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Workspace
  const { data: workspaceData, refetch: refetchWorkspace } = useQuery({
    queryKey: ["workspace-details", workspace?.workspace_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*, settings, workspace_members(*, profiles(full_name, avatar_url))")
        .eq("id", workspace!.workspace_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!workspace?.workspace_id,
  });

  // Sync outreach settings from already-fetched workspaceData (avoids double query)
  // M-3 fix: removed separate useEffect that issued a second workspaces SELECT.
  useEffect(() => {
    if (workspaceData) {
      const s = (workspaceData as any).settings as any;
      if (s) {
        setDefaultFromName(s.default_from_name || "");
        setDefaultReplyTo(s.default_reply_to || "");
      }
    }
  }, [workspaceData]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 1024 * 1024) {
      toast({ title: "File too large", description: "Avatar must be under 1 MB.", variant: "destructive" });
      return;
    }
    setAvatarUploading(true);
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
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
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
      setProfileSaving(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Weak password", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setPasswordSaving(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Password updated" });
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleOutreachSave = async () => {
    if (!workspace?.workspace_id) return;
    setOutreachSaving(true);
    try {
      const { data: current } = await supabase
        .from("workspaces")
        .select("settings")
        .eq("id", workspace.workspace_id)
        .single();
      const existingSettings = (current?.settings as any) || {};
      const newSettings = {
        ...existingSettings,
        default_from_name: defaultFromName.trim() || null,
        default_reply_to: defaultReplyTo.trim() || null,
      };
      const { error } = await supabase.rpc("update_workspace_settings", {
        _workspace_id: workspace.workspace_id,
        _settings: newSettings,
      });
      if (error) throw error;
      toast({ title: "Outreach settings saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save outreach settings.", variant: "destructive" });
    } finally {
      setOutreachSaving(false);
    }
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
  const roleLabels: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member" };

  // ── MFA Handlers ─────────────────────────────────────────────────────────
  const handleEnable2FA = async () => {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setMfaEnrollData({ factorId: data.id, qrCodeUrl: data.totp.qr_code, secret: data.totp.secret });
    } catch (err: any) {
      toast({ title: "Error enabling 2FA", description: err.message, variant: "destructive" });
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!mfaEnrollData || mfaCode.length < 6) return;
    setMfaVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaEnrollData.factorId, code: mfaCode });
      if (error) throw error;
      toast({ title: "2FA enabled", description: "Your account is now protected with two-factor authentication." });
      setMfaEnrollData(null);
      setMfaCode("");
      await refetchMfa();
    } catch (err: any) {
      toast({ title: "Invalid code", description: err.message, variant: "destructive" });
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!totpFactor) return;
    setMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) throw error;
      toast({ title: "2FA disabled" });
      await refetchMfa();
    } catch (err: any) {
      toast({ title: "Error disabling 2FA", description: err.message, variant: "destructive" });
    } finally {
      setMfaLoading(false);
    }
  };

  // ── Session Handler ───────────────────────────────────────────────────────
  const handleSignOutOtherSessions = async () => {
    setSigningOutOthers(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast({ title: "Signed out all other sessions" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSigningOutOthers(false);
    }
  };

  // ── Member Handlers ────────────────────────────────────────────────────────
  const handleRemoveMember = async (userId: string) => {
    if (!workspace?.workspace_id) return;
    try {
      const { data, error } = await supabase.rpc("remove_workspace_member", {
        p_workspace_id: workspace.workspace_id,
        p_user_id: userId,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      toast({ title: "Member removed" });
      refetchWorkspace();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleInviteMember = async () => {
    if (!workspace?.workspace_id || !inviteEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.rpc("invite_workspace_member", {
        p_workspace_id: workspace.workspace_id,
        p_email: inviteEmail.trim(),
        p_role: inviteRole,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      toast({ title: "Member added", description: `${inviteEmail.trim()} has been added to the workspace.` });
      setInviteEmail("");
      setShowInviteModal(false);
      refetchWorkspace();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-56 flex-shrink-0 space-y-1 overflow-x-auto md:overflow-visible flex md:block pb-2 md:pb-0 scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.label}
              onClick={() => setActiveTab(t.label)}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all text-left whitespace-nowrap min-w-max md:min-w-0 md:w-full font-medium ${activeTab === t.label ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
            >
              <t.icon size={16} strokeWidth={activeTab === t.label ? 2 : 1.5} />
              {t.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 min-w-0">
          {activeTab === "Profile" && (
            <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Public Profile</h2>
                <p className="text-sm text-muted-foreground">This is how you appear to others on the platform.</p>
              </div>

              <div className="flex items-center gap-5 pb-2">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary border-2 border-primary/20">{initials}</div>
                )}
                <div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-8 px-3 font-medium mb-1.5"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Camera size={14} className="mr-1.5" />}
                    {avatarUploading ? "Uploading…" : "Upload photo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG, PNG, GIF or WebP. 1 MB max.</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">First name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">Last name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">Email address</label>
                <div className="relative opacity-70">
                  <Mail size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" value={user?.email || ""} disabled className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-muted/50 text-sm text-foreground cursor-not-allowed" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">To change your email address, contact support.</p>
              </div>

              <div className="pt-2 border-t border-border/50">
                <Button className="rounded-lg font-medium btn-shine shadow-sm" onClick={handleProfileSave} disabled={profileSaving}>
                  {profileSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {activeTab === "Workspace" && (
            <div className="space-y-5">
              <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Company Details</h2>
                  <p className="text-sm text-muted-foreground">Manage your workspace settings and branding.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Workspace name</label>
                    <input type="text" value={workspaceData?.name || ""} disabled className="w-full h-10 px-3 rounded-lg border border-border bg-muted/50 opacity-70 cursor-not-allowed text-sm text-foreground" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Workspace URL slug</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-border bg-muted/30 text-muted-foreground text-sm">app.mushin.com/</span>
                      <input type="text" value={workspaceData?.name?.toLowerCase().replace(/\s+/g, "-") || ""} disabled className="flex-1 min-w-0 h-10 px-3 rounded-r-lg border border-border bg-muted/50 opacity-70 cursor-not-allowed text-sm text-foreground" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-6 md:p-8 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground mb-1">Team Members</h2>
                      <p className="text-sm text-muted-foreground">Manage who has access to this workspace.</p>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-lg h-9 font-medium" onClick={() => setShowInviteModal(true)}><UserPlus size={14} strokeWidth={2} className="mr-1.5" /> Invite Member</Button>
                  </div>
                </div>

                <div className="border-t border-border/50">
                  <table className="w-full">
                    <thead className="bg-muted/30">
                      <tr>
                        <th className="text-left text-xs font-medium text-muted-foreground px-6 md:px-8 py-3 w-full">User</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-6 py-3 whitespace-nowrap">Role</th>
                        <th className="text-right text-xs font-medium text-muted-foreground px-6 md:px-8 py-3 whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {(workspaceData as any)?.workspace_members?.map((member: any) => {
                        const mp = member.profiles;
                        const memberInitials = mp?.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase() || "?";
                        return (
                          <tr key={member.id} className="hover:bg-muted/10 transition-colors">
                            <td className="px-6 md:px-8 py-3">
                              <div className="flex items-center gap-3">
                                {mp?.avatar_url ? (
                                  <img src={mp.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full border border-border/50" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{memberInitials}</div>
                                )}
                                <div>
                                  <p className="text-sm font-medium text-foreground leading-tight">{mp?.full_name || "Unknown"}</p>
                                  {user?.id === member.user_id && <p className="text-[11px] text-muted-foreground mt-0.5">You</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              <Badge variant="outline" className={`font-normal rounded-md px-2 py-0.5 ${member.role === 'owner' ? 'bg-primary/5 text-primary border-primary/20' : 'bg-muted/30 text-muted-foreground'}`}>
                                {roleLabels[member.role] || member.role}
                              </Badge>
                            </td>
                            <td className="px-6 md:px-8 py-3 text-right">
                              {member.role !== "owner" && user?.id !== member.user_id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2"
                                  onClick={() => handleRemoveMember(member.user_id)}
                                >
                                  <Trash2 size={14} strokeWidth={1.5} />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Email Outreach Defaults</h2>
                  <p className="text-sm text-muted-foreground">Default settings used when sending campaigns and emails.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Default sender name</label>
                    <input type="text" value={defaultFromName} onChange={(e) => setDefaultFromName(e.target.value)} placeholder="Company Name" className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Default reply-to email</label>
                    <div className="relative">
                      <Mail size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="email" value={defaultReplyTo} onChange={(e) => setDefaultReplyTo(e.target.value)} placeholder="hello@company.com" className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <Button className="rounded-lg font-medium shadow-sm" onClick={handleOutreachSave} disabled={outreachSaving}>
                    {outreachSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Defaults
                  </Button>
                </div>
              </div>

              <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8">
                <EmailTemplateManager />
              </div>

              <DataManagement />
            </div>
          )}

          {activeTab === "Integrations" && (
            <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8">
              <IntegrationsTab />
            </div>
          )}

          {activeTab === "Security" && (
            <div className="space-y-5">
              {/* Change Password */}
              <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Change Password</h2>
                  <p className="text-sm text-muted-foreground">Use a strong, unique password of at least 8 characters.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">New password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Confirm new password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <Button className="rounded-lg font-medium shadow-sm" onClick={handlePasswordUpdate} disabled={passwordSaving || newPassword.length < 8 || newPassword !== confirmPassword}>
                    {passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </div>
              </div>

              {/* Two-Factor Authentication */}
              <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground mb-1">Two-Factor Authentication</h2>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security via an authenticator app.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {twoFAEnabled && (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-normal text-xs">
                        <Shield size={11} className="mr-1" /> Enabled
                      </Badge>
                    )}
                    <Switch
                      checked={twoFAEnabled}
                      onCheckedChange={twoFAEnabled ? handleDisable2FA : handleEnable2FA}
                      disabled={mfaLoading}
                    />
                  </div>
                </div>

                {mfaEnrollData && (
                  <div className="border border-border/50 rounded-xl p-5 space-y-4 bg-muted/10">
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <QrCode size={15} className="text-primary" /> Scan with your authenticator app (Google Auth, Authy, etc.)
                    </p>
                    <div className="flex flex-col sm:flex-row items-start gap-6">
                      <img src={mfaEnrollData.qrCodeUrl} alt="2FA QR Code" className="w-36 h-36 rounded-lg border border-border bg-white p-1" />
                      <div className="space-y-3 flex-1">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Manual entry key:</p>
                          <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded text-foreground break-all">{mfaEnrollData.secret}</code>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground block">Enter the 6-digit code to verify</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              maxLength={6}
                              value={mfaCode}
                              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                              placeholder="000000"
                              className="w-32 h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <Button onClick={handleVerify2FA} disabled={mfaCode.length < 6 || mfaVerifying} className="rounded-lg">
                              {mfaVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Verify
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setMfaEnrollData(null); setMfaCode(""); }}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {/* Active Sessions */}
              <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Active Sessions</h2>
                  <p className="text-sm text-muted-foreground">Manage devices signed into your account.</p>
                </div>

                <div className="border border-border/50 rounded-xl p-4 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <Monitor size={18} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Current Session
                        <Badge variant="outline" className="ml-2 text-[10px] bg-primary/5 text-primary border-primary/20 rounded-md">Active</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8 font-medium"
                    onClick={handleSignOutOtherSessions}
                    disabled={signingOutOthers}
                  >
                    {signingOutOthers && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Sign out other sessions
                  </Button>
                </div>

                <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                  <AlertCircle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    "Sign out other sessions" revokes all active logins except this browser session.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Invite Member Modal ──────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-xl p-6 w-full max-w-md space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Invite Team Member</h3>
                <p className="text-sm text-muted-foreground mt-0.5">The user must already have an account.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowInviteModal(false)} className="text-muted-foreground h-8 w-8">
                <X size={16} />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">Email address</label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInviteMember()}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setShowInviteModal(false)}>Cancel</Button>
              <Button className="flex-1 rounded-lg" onClick={handleInviteMember} disabled={inviting || !inviteEmail.trim()}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Member
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
