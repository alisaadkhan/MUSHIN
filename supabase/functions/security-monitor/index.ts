import { createPrivilegedClient, getServiceRoleKey, requireInternalGatewaySecret } from "../_shared/privileged_gateway.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { corsHeaders } from "../_shared/rate_limit.ts";

type SecurityEventRow = {
  user_id: string | null;
  ip_address: string | null;
  event_type: string;
  risk_score: number;
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
    const body = await req.json().catch(() => ({}));

    const lookbackMinutes = Number(body?.lookback_minutes ?? 30);
    const loginFailThreshold = Number(body?.login_fail_threshold ?? 5);
    const creditSpikeThreshold = Number(body?.credit_spike_threshold ?? 100);
    const apiVolumeThreshold = Number(body?.api_volume_threshold ?? 120);
    const ipChangeThreshold = Number(body?.ip_change_threshold ?? 3);

    const now = new Date();
    const since = new Date(now.getTime() - lookbackMinutes * 60 * 1000).toISOString();
    const sinceDay = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const events: SecurityEventRow[] = [];

    // Repeated failed logins
    const { data: failedLogins, error: failedLoginErr } = await client
      .from("system_audit_logs")
      .select("actor_user_id, ip_address, metadata_json, action_type, timestamp")
      .eq("action_type", "auth:login_attempt")
      .gte("timestamp", since)
      .order("timestamp", { ascending: false });
    if (failedLoginErr) throw failedLoginErr;

    const failedByActor = new Map<string, { count: number; ips: Set<string> }>();
    for (const row of failedLogins ?? []) {
      const status = (row.metadata_json as Record<string, unknown> | null)?.status;
      if (status !== "failed") continue;
      const key = row.actor_user_id ?? `ip:${row.ip_address ?? "unknown"}`;
      const existing = failedByActor.get(key) ?? { count: 0, ips: new Set<string>() };
      existing.count += 1;
      if (row.ip_address) existing.ips.add(row.ip_address);
      failedByActor.set(key, existing);
    }
    for (const [key, val] of failedByActor.entries()) {
      if (val.count >= loginFailThreshold) {
        const userId = key.startsWith("ip:") ? null : key;
        events.push({
          user_id: userId,
          ip_address: userId ? null : key.replace("ip:", ""),
          event_type: "repeated_failed_logins",
          risk_score: Math.min(100, 40 + val.count * 5),
          metadata: { failed_attempts: val.count, distinct_ips: val.ips.size, lookback_minutes: lookbackMinutes },
        });
      }
    }

    // Unusual credit usage spikes
    const { data: creditRows, error: creditErr } = await client
      .from("credit_consumption_metrics")
      .select("workspace_id, user_id, credit_type, delta, timestamp")
      .gte("timestamp", since)
      .order("timestamp", { ascending: false });
    if (creditErr) throw creditErr;

    const creditByWorkspace = new Map<string, { totalAbs: number; events: number }>();
    for (const row of creditRows ?? []) {
      const key = row.workspace_id;
      const current = creditByWorkspace.get(key) ?? { totalAbs: 0, events: 0 };
      current.totalAbs += Math.abs(Number(row.delta ?? 0));
      current.events += 1;
      creditByWorkspace.set(key, current);
    }
    for (const [workspaceId, info] of creditByWorkspace.entries()) {
      if (info.totalAbs >= creditSpikeThreshold) {
        events.push({
          user_id: null,
          ip_address: null,
          event_type: "credit_usage_spike",
          risk_score: Math.min(100, 30 + Math.floor(info.totalAbs / 10)),
          metadata: { workspace_id: workspaceId, total_abs_delta: info.totalAbs, event_count: info.events, lookback_minutes: lookbackMinutes },
        });
      }
    }

    // Abnormal API call volume
    const { data: apiRows, error: apiErr } = await client
      .from("api_usage_metrics")
      .select("workspace_id, endpoint, status_code, timestamp")
      .gte("timestamp", since)
      .order("timestamp", { ascending: false });
    if (apiErr) throw apiErr;

    const apiByWorkspace = new Map<string, number>();
    for (const row of apiRows ?? []) {
      const key = row.workspace_id ?? "unknown";
      apiByWorkspace.set(key, (apiByWorkspace.get(key) ?? 0) + 1);
    }
    for (const [workspaceId, count] of apiByWorkspace.entries()) {
      if (count >= apiVolumeThreshold) {
        events.push({
          user_id: null,
          ip_address: null,
          event_type: "abnormal_api_volume",
          risk_score: Math.min(100, 25 + Math.floor(count / 4)),
          metadata: { workspace_id: workspaceId, request_count: count, lookback_minutes: lookbackMinutes },
        });
      }
    }

    // Suspicious IP changes by actor
    const { data: actorIpRows, error: actorIpErr } = await client
      .from("system_audit_logs")
      .select("actor_user_id, ip_address, timestamp")
      .not("actor_user_id", "is", null)
      .gte("timestamp", sinceDay)
      .order("timestamp", { ascending: false });
    if (actorIpErr) throw actorIpErr;

    const ipsByActor = new Map<string, Set<string>>();
    for (const row of actorIpRows ?? []) {
      if (!row.actor_user_id || !row.ip_address) continue;
      const set = ipsByActor.get(row.actor_user_id) ?? new Set<string>();
      set.add(row.ip_address);
      ipsByActor.set(row.actor_user_id, set);
    }
    for (const [actorUserId, ips] of ipsByActor.entries()) {
      if (ips.size >= ipChangeThreshold) {
        events.push({
          user_id: actorUserId,
          ip_address: null,
          event_type: "suspicious_ip_changes",
          risk_score: Math.min(100, 35 + ips.size * 10),
          metadata: { distinct_ips_24h: ips.size, sample_ips: Array.from(ips).slice(0, 10) },
        });
      }
    }

    if (events.length > 0) {
      const { error: insertErr } = await client.from("security_events").insert(events);
      if (insertErr) throw insertErr;

      const alerts = events
        .filter((e) => e.risk_score >= 70)
        .map((e) => ({
          alert_type: e.event_type,
          severity: e.risk_score >= 90 ? "critical" : "high",
          user_id: e.user_id,
          metadata: e.metadata,
        }));

      if (alerts.length > 0) {
        const { error: alertErr } = await client.from("security_alerts").insert(alerts);
        if (alertErr) throw alertErr;
      }

      await client.rpc("promote_security_events_to_alerts", {
        p_lookback_minutes: lookbackMinutes,
        p_threshold: 3,
      });
    }

    await client.rpc("record_system_metric", {
      p_metric_name: "security_monitor_events_generated",
      p_metric_value: events.length,
      p_tags: {
        lookback_minutes: lookbackMinutes,
      },
    });

    return new Response(JSON.stringify({ success: true, events_generated: events.length, events }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return safeErrorResponse(err, "[security-monitor]", corsHeaders);
  }
});
