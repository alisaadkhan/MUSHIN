import { supabase } from "@/integrations/supabase/client";

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Fire a no-cors POST to a webhook URL. Fails silently.
 */
export async function fireWebhook(url: string | null | undefined, payload: WebhookPayload) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fail silently – webhooks should not block the user
  }
}

/**
 * Fire a Slack-formatted message to a webhook URL. Fails silently.
 */
export async function fireSlackWebhook(url: string | null | undefined, text: string) {
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // Fail silently
  }
}

/**
 * Fetch workspace integration settings from the workspaces table.
 */
export async function getIntegrationSettings(workspaceId: string) {
  const { data } = await supabase
    .from("workspaces")
    .select("settings")
    .eq("id", workspaceId)
    .single();
  const s = data?.settings as Record<string, unknown> | null;
  return {
    zapier_webhook_url: (s?.zapier_webhook_url as string) || null,
    google_sheets_webhook_url: (s?.google_sheets_webhook_url as string) || null,
    hubspot_api_key: (s?.hubspot_api_key as string) || null,
    slack_webhook_url: (s?.slack_webhook_url as string) || null,
  };
}

/**
 * Fire integration webhooks for a given event.
 */
export async function notifyIntegrations(
  workspaceId: string,
  event: string,
  data: Record<string, unknown>
) {
  const settings = await getIntegrationSettings(workspaceId);
  const payload: WebhookPayload = { event, timestamp: new Date().toISOString(), data };

  const promises: Promise<void>[] = [];

  // Zapier
  promises.push(fireWebhook(settings.zapier_webhook_url, payload));

  // Google Sheets
  promises.push(fireWebhook(settings.google_sheets_webhook_url, payload));

  // Slack – send a formatted text message
  const slackText = `📢 *${event}*\n${Object.entries(data).map(([k, v]) => `• ${k}: ${v}`).join("\n")}`;
  promises.push(fireSlackWebhook(settings.slack_webhook_url, slackText));

  await Promise.allSettled(promises);
}
