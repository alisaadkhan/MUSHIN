import { createPrivilegedClient, getServiceRoleKey, requireInternalGatewaySecret } from "../_shared/privileged_gateway.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { corsHeaders } from "../_shared/rate_limit.ts";

type AlertRow = {
  id: string;
  timestamp: string;
  alert_type: string;
  severity: "low" | "medium" | "high" | "critical";
  user_id: string | null;
  metadata: Record<string, unknown>;
};

function isInternalRequest(req: Request): boolean {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token && token === getServiceRoleKey()) return true;
  try {
    requireInternalGatewaySecret(req);
    return true;
  } catch {
    return false;
  }
}

async function dispatchWebhook(url: string, alert: AlertRow) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "mushin-security",
      alert,
    }),
  });
}

async function dispatchEmail(alertEmailWebhook: string, alert: AlertRow) {
  await fetch(alertEmailWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: "security@mushin.app",
      subject: `[Mushin Alert] ${alert.severity.toUpperCase()} - ${alert.alert_type}`,
      text: JSON.stringify(alert, null, 2),
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isInternalRequest(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const client = createPrivilegedClient();
    const maxBatch = 100;

    const { data, error } = await client
      .from("security_alerts")
      .select("id, timestamp, alert_type, severity, user_id, metadata")
      .eq("dispatched", false)
      .order("timestamp", { ascending: true })
      .limit(maxBatch);
    if (error) throw error;

    const alerts = (data ?? []) as AlertRow[];
    if (alerts.length === 0) {
      return new Response(JSON.stringify({ success: true, dispatched: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = Deno.env.get("ALERT_WEBHOOK_URL") ?? "";
    const emailWebhook = Deno.env.get("ALERT_EMAIL_WEBHOOK_URL") ?? "";

    for (const alert of alerts) {
      if (webhookUrl) {
        await dispatchWebhook(webhookUrl, alert);
      }
      if (emailWebhook) {
        await dispatchEmail(emailWebhook, alert);
      }
    }

    const ids = alerts.map((a) => a.id);
    const { error: markError } = await client
      .from("security_alerts")
      .update({ dispatched: true, dispatched_at: new Date().toISOString() })
      .in("id", ids);
    if (markError) throw markError;

    await client.rpc("record_system_metric", {
      p_metric_name: "security_alerts_dispatched",
      p_metric_value: alerts.length,
      p_tags: { batch_size: alerts.length },
    });

    return new Response(JSON.stringify({ success: true, dispatched: alerts.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return safeErrorResponse(err, "[alert-dispatcher]", corsHeaders);
  }
});
