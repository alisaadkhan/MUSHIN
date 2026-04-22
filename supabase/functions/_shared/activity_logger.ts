import { UAParser } from "npm:ua-parser-js";
import { createPrivilegedClient } from "./privileged_gateway.ts";

type ActivityStatus = "success" | "error";

function getIpAddress(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? null;
}

function getDeviceInfo(req: Request): string | null {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua) return null;
  try {
    const parser = new UAParser(ua);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    const parts = [
      browser.name ? `${browser.name}${browser.version ? ` ${browser.version}` : ""}` : null,
      os.name ? `${os.name}${os.version ? ` ${os.version}` : ""}` : null,
      device.type ? `${device.type}${device.model ? ` ${device.model}` : ""}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : ua.slice(0, 220);
  } catch {
    return ua.slice(0, 220);
  }
}

export async function logUserActivity(args: {
  req: Request;
  userId: string | null;
  workspaceId: string | null;
  actionType: string;
  status: ActivityStatus;
  metadata?: Record<string, unknown>;
}) {
  // Best-effort only: analytics must never break core flows.
  try {
    if (!args.userId) return;
    const client = createPrivilegedClient();
    await client.from("user_activity_logs").insert({
      user_id: args.userId,
      workspace_id: args.workspaceId ?? null,
      action_type: args.actionType,
      status: args.status,
      metadata: args.metadata ?? {},
      ip_address: getIpAddress(args.req),
      device_info: getDeviceInfo(args.req),
    });
  } catch (err) {
    console.warn("[activity_logger] failed to insert activity log:", err);
  }
}

