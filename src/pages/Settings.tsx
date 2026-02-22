import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { EmailTemplateManager } from "@/components/campaigns/EmailTemplateManager";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { DataManagement } from "@/components/settings/DataManagement";

export default function Settings() {
  const { user, profile, workspace, updatePassword, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [profileSaving, setProfileSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [defaultFromName, setDefaultFromName] = useState("");
  const [defaultReplyTo, setDefaultReplyTo] = useState("");
  const [outreachSaving, setOutreachSaving] = useState(false);

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
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, avatar_url: avatarUrl.trim() || null })
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

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="data">Data & Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <div className="glass-card p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="settingsName">Full name</Label>
              <Input id="settingsName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
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
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <div className="glass-card p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
            </div>
            <Button onClick={handlePasswordUpdate} disabled={passwordSaving}>
              {passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="outreach" className="mt-6 space-y-6">
          <div className="glass-card p-6 space-y-6">
            <h3 className="text-sm font-semibold">Email Defaults</h3>
            <div className="space-y-2">
              <Label htmlFor="fromName">Default sender name</Label>
              <Input id="fromName" value={defaultFromName} onChange={(e) => setDefaultFromName(e.target.value)} placeholder="Your Name or Company" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replyTo">Default reply-to email</Label>
              <Input id="replyTo" type="email" value={defaultReplyTo} onChange={(e) => setDefaultReplyTo(e.target.value)} placeholder="you@company.com" />
            </div>
            <Button onClick={handleOutreachSave} disabled={outreachSaving}>
              {outreachSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
          <div className="glass-card p-6">
            <EmailTemplateManager />
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <DataManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
