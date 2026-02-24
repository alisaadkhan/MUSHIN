import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Shield, UserPlus, Monitor, Smartphone } from "lucide-react";
import { EmailTemplateManager } from "@/components/campaigns/EmailTemplateManager";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { DataManagement } from "@/components/settings/DataManagement";
import { useQuery } from "@tanstack/react-query";

export default function Settings() {
  const { user, profile, workspace, updatePassword, refreshProfile } = useAuth();
  const { toast } = useToast();

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

  // Placeholder sessions
  const sessions = [
    { device: "Chrome · macOS", icon: Monitor, location: "Current session", current: true },
    { device: "Safari · iPhone", icon: Smartphone, location: "Mobile", current: false },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Profile */}
        <TabsContent value="profile" className="mt-6">
          <Card className="glass-card">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-lg bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{firstName} {lastName}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settingsAvatar">Avatar URL</Label>
                <Input id="settingsAvatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="opacity-60" />
              </div>
              <Button onClick={handleProfileSave} disabled={profileSaving}>
                {profileSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workspace */}
        <TabsContent value="workspace" className="mt-6 space-y-4">
          <Card className="glass-card">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Workspace Name</Label>
                <Input value={workspaceData?.name || ""} disabled className="opacity-60" />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={workspaceData?.name?.toLowerCase().replace(/\s+/g, "-") || ""} disabled className="opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                Members
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
                  <UserPlus className="h-3 w-3" />
                  Invite
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <div className="space-y-3">
                {(workspaceData as any)?.workspace_members?.map((member: any) => {
                  const mp = member.profiles;
                  const memberInitials = mp?.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase() || "?";
                  return (
                    <div key={member.id} className="flex items-center gap-3 py-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={mp?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs bg-muted">{memberInitials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{mp?.full_name || "Unknown"}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {roleLabels[member.role] || member.role}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Outreach settings under workspace */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Email Defaults</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fromName">Default sender name</Label>
                <Input id="fromName" value={defaultFromName} onChange={(e) => setDefaultFromName(e.target.value)} placeholder="Your Name or Company" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="replyTo">Default reply-to email</Label>
                <Input id="replyTo" type="email" value={defaultReplyTo} onChange={(e) => setDefaultReplyTo(e.target.value)} placeholder="you@company.com" />
              </div>
              <Button onClick={handleOutreachSave} disabled={outreachSaving} size="sm">
                {outreachSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-6">
              <EmailTemplateManager />
            </CardContent>
          </Card>
          <DataManagement />
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-6 space-y-4">
          <Card className="glass-card">
            <CardContent className="p-6 space-y-6">
              <h3 className="text-sm font-semibold">Change Password</h3>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
              </div>
              <Button onClick={handlePasswordUpdate} disabled={passwordSaving} size="sm">
                {passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Two-Factor Authentication</h3>
                  <p className="text-xs text-muted-foreground mt-1">Add an extra layer of security to your account</p>
                </div>
                <Switch checked={twoFAEnabled} onCheckedChange={setTwoFAEnabled} />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Sessions</CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <div className="space-y-3">
                {sessions.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {s.device}
                          {s.current && <Badge variant="outline" className="ml-2 text-[10px]">Current</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.location}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
