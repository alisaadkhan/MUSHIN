import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Webhook, Sheet, MessageSquare, CheckCircle2, XCircle } from "lucide-react";

export function IntegrationsTab() {
  const { workspace } = useAuth();
  const { toast } = useToast();

  const [zapierUrl, setZapierUrl] = useState("");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [hubspotKey, setHubspotKey] = useState("");
  const [hubspotConfigured, setHubspotConfigured] = useState(false);
  const [slackUrl, setSlackUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workspace?.workspace_id) return;

    // Load non-secret settings from workspaces.settings
    supabase
      .from("workspaces")
      .select("settings")
      .eq("id", workspace.workspace_id)
      .single()
      .then(({ data }) => {
        const s = data?.settings as any;
        if (s) {
          setZapierUrl(s.zapier_webhook_url || "");
          setSheetsUrl(s.google_sheets_webhook_url || "");
          setSlackUrl(s.slack_webhook_url || "");
        }
      });

    // Check if HubSpot key is configured (without exposing the key)
    supabase.rpc("get_hubspot_configured", { _workspace_id: workspace.workspace_id })
      .then(({ data }) => {
        setHubspotConfigured(!!data);
      });
  }, [workspace?.workspace_id]);

  const handleSave = async () => {
    if (!workspace?.workspace_id) return;
    setSaving(true);
    try {
      // Save non-secret webhook URLs via RPC
      const { data: current } = await supabase
        .from("workspaces")
        .select("settings")
        .eq("id", workspace.workspace_id)
        .single();

      const existing = (current?.settings as any) || {};
      const newSettings = {
        ...existing,
        zapier_webhook_url: zapierUrl.trim() || null,
        google_sheets_webhook_url: sheetsUrl.trim() || null,
        slack_webhook_url: slackUrl.trim() || null,
      };

      // Remove hubspot_api_key from settings if it was previously stored there
      delete newSettings.hubspot_api_key;

      await supabase.rpc("update_workspace_settings", {
        _workspace_id: workspace.workspace_id,
        _settings: newSettings,
      });

      // Save HubSpot key to workspace_secrets if provided
      if (hubspotKey.trim()) {
        const { error: upsertError } = await supabase
          .from("workspace_secrets" as any)
          .upsert(
            { workspace_id: workspace.workspace_id, hubspot_api_key: hubspotKey.trim() },
            { onConflict: "workspace_id" }
          );
        if (upsertError) throw upsertError;
        setHubspotConfigured(true);
        setHubspotKey(""); // Clear from state after saving
      }

      toast({ title: "Integrations saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save integrations.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 space-y-6">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" /> Zapier
        </h3>
        <div className="space-y-2">
          <Label htmlFor="zapierUrl">Webhook URL</Label>
          <Input
            id="zapierUrl"
            value={zapierUrl}
            onChange={(e) => setZapierUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/hooks/catch/..."
          />
          <p className="text-xs text-muted-foreground">Events: influencer added, campaign status changed, email sent</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-6">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Sheet className="h-4 w-4 text-primary" /> Google Sheets
        </h3>
        <div className="space-y-2">
          <Label htmlFor="sheetsUrl">Webhook URL (Apps Script or Zapier)</Label>
          <Input
            id="sheetsUrl"
            value={sheetsUrl}
            onChange={(e) => setSheetsUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/..."
          />
          <p className="text-xs text-muted-foreground">Use "Export to Sheets" buttons on lists and campaigns</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-6">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="currentColor"><path d="M22.2 1H1.8C.8 1 0 1.8 0 2.8v18.4C0 22.2.8 23 1.8 23h20.4c1 0 1.8-.8 1.8-1.8V2.8C24 1.8 23.2 1 22.2 1zM7.4 19.4H4V9.4h3.4v10zM5.7 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 19.4h-3.4V14c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.5h-3.4V9.4H12v1.4h.1c.5-.9 1.6-1.8 3.3-1.8 3.5 0 4.1 2.3 4.1 5.3v5.1h.5z"/></svg>
          HubSpot
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            {hubspotConfigured ? (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" /> API key configured
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <XCircle className="h-3.5 w-3.5" /> Not configured
              </span>
            )}
          </div>
          <Label htmlFor="hubspotKey">
            {hubspotConfigured ? "Update Private App Token" : "Private App Token"}
          </Label>
          <Input
            id="hubspotKey"
            type="password"
            value={hubspotKey}
            onChange={(e) => setHubspotKey(e.target.value)}
            placeholder={hubspotConfigured ? "Enter new token to update" : "pat-na1-..."}
          />
          <p className="text-xs text-muted-foreground">Sync confirmed influencers as HubSpot contacts. Token is stored securely and never exposed.</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-6">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Slack
        </h3>
        <div className="space-y-2">
          <Label htmlFor="slackUrl">Incoming Webhook URL</Label>
          <Input
            id="slackUrl"
            value={slackUrl}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
          />
          <p className="text-xs text-muted-foreground">Get notified when campaigns go active or influencers are confirmed</p>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save Integrations
      </Button>
    </div>
  );
}
