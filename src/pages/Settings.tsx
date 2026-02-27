import { useState, useEffect } from "react";
import { User, Globe, Lock, Zap, Mail, Plus, Trash2, Camera, MapPin, Monitor, Smartphone, Loader2, Shield, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmailTemplateManager } from "@/components/campaigns/EmailTemplateManager";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { DataManagement } from "@/components/settings/DataManagement";
import { useQuery } from "@tanstack/react-query";

const tabs = [
  { label: "Profile", icon: User },
  { label: "Workspace", icon: Globe },
  { label: "Integrations", icon: Zap },
  { label: "Security", icon: Lock },
];

export default function Settings() {
  const { user, profile, workspace, updatePassword, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("Profile");

  // Profile
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      const parts = profile.full_name.split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
  }, [profile?.full_name]);

  // Security
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  // Outreach
  const [defaultFromName, setDefaultFromName] = useState("");
  const [defaultReplyTo, setDefaultReplyTo] = useState("");
  const [outreachSaving, setOutreachSaving] = useState(false);

  // Workspace
  const { data: workspaceData } = useQuery({
    queryKey: ["workspace-details", workspace?.workspace_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*, workspace_members(*, profiles(full_name, avatar_url))")
        .eq("id", workspace!.workspace_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!workspace?.workspace_id,
  });

  useEffect(() => {
    if (workspace?.workspace_id) {
      supabase
        .from("workspaces")
        .select("settings")
        .eq("id", workspace.workspace_id)
        .single()
        .then(({ data }) => {
          const s = data?.settings as any;
          if (s) {
            setDefaultFromName(s.default_from_name || "");
            setDefaultReplyTo(s.default_reply_to || "");
          }
        });
    }
  }, [workspace?.workspace_id]);

  const handleProfileSave = async () => {
    if (avatarUrl.trim() && !/^https?:\/\/.+/.test(avatarUrl.trim())) {
      toast({ title: "Invalid URL", description: "Avatar URL must start with http:// or https://", variant: "destructive" });
      return;
    }
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
    if (newPassword.length < 6) {
      toast({ title: "Weak password", description: "Password must be at least 6 characters.", variant: "destructive" });
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

  const sessions = [
    { device: "Chrome · macOS", icon: Monitor, location: "Current session", current: true },
    { device: "Safari · iPhone", icon: Smartphone, location: "Mobile", current: false },
  ];

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
            <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-6">
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
                  <Button variant="outline" size="sm" className="rounded-lg h-8 px-3 font-medium mb-1.5"><Camera size={14} className="mr-1.5" />Change avatar</Button>
                  <p className="text-xs text-muted-foreground">JPG, GIF or PNG. 1MB max.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground block">Avatar URL</label>
                <div className="relative">
                  <Globe size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg" className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">First name</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">Last name</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
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
              <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-6">
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
                      <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-border bg-muted/30 text-muted-foreground text-sm">app.influenceiq.com/</span>
                      <input type="text" value={workspaceData?.name?.toLowerCase().replace(/\s+/g, "-") || ""} disabled className="flex-1 min-w-0 h-10 px-3 rounded-r-lg border border-border bg-muted/50 opacity-70 cursor-not-allowed text-sm text-foreground" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-6 md:p-8 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground mb-1">Team Members</h2>
                      <p className="text-sm text-muted-foreground">Manage who has access to this workspace.</p>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-lg h-9 font-medium" disabled><UserPlus size={14} strokeWidth={2} className="mr-1.5" /> Invite Member</Button>
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
                              {member.role !== "owner" && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2">
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

              <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Email Outreach Defaults</h2>
                  <p className="text-sm text-muted-foreground">Default settings used when sending campaigns and emails.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Default sender name</label>
                    <input type="text" value={defaultFromName} onChange={(e) => setDefaultFromName(e.target.value)} placeholder="Company Name" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Default reply-to email</label>
                    <div className="relative">
                      <Mail size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="email" value={defaultReplyTo} onChange={(e) => setDefaultReplyTo(e.target.value)} placeholder="hello@company.com" className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
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

              <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8">
                <EmailTemplateManager />
              </div>

              <DataManagement />
            </div>
          )}

          {activeTab === "Integrations" && (
            <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8">
              <IntegrationsTab />
            </div>
          )}

          {activeTab === "Security" && (
            <div className="space-y-5">
              <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Change Password</h2>
                  <p className="text-sm text-muted-foreground">Ensure your account uses a strong, unique password.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">New password</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground block">Confirm new password</label>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <Button className="rounded-lg font-medium shadow-sm" onClick={handlePasswordUpdate} disabled={passwordSaving || newPassword.length < 6 || newPassword !== confirmPassword}>
                    {passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Two-Factor Authentication</h2>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
                </div>
                <Switch checked={twoFAEnabled} onCheckedChange={setTwoFAEnabled} />
              </div>

              <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-1">Active Sessions</h2>
                  <p className="text-sm text-muted-foreground">Devices currently signed into your account.</p>
                </div>

                <div className="space-y-3">
                  {sessions.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-border/50 rounded-xl p-4 bg-muted/10">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                            <Icon size={18} strokeWidth={1.5} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {s.device}
                              {s.current && <Badge variant="outline" className="ml-2 text-[10px] bg-primary/5 text-primary border-primary/20 rounded-md">Current</Badge>}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                              <MapPin size={12} strokeWidth={1.5} />
                              {s.location}
                            </div>
                          </div>
                        </div>
                        {!s.current && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 font-medium">
                            Revoke access
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
