import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, requireSystemAdmin } from "../_shared/privileged_gateway.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body =
  | { action: "list_announcements" }
  | { action: "create_announcement"; title: string; body: string; type: string }
  | { action: "deactivate"; id: string }
  | { action: "delete"; id: string }
  | { action: "list_notification_log"; limit?: number };

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 30, perHour: 300 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    await requireSystemAdmin(authHeader);
    const body = (await req.json().catch(() => ({}))) as Body;
    const client = createPrivilegedClient();

    if (body.action === "list_announcements") {
      const { data, error } = await client.from("announcements").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return json({ success: true, announcements: data ?? [] }, 200, cors);
    }

    if (body.action === "create_announcement") {
      const title = String((body as any).title ?? "").trim();
      const text = String((body as any).body ?? "").trim();
      const type = String((body as any).type ?? "info").trim();
      if (!title || !text) return validationErrorResponse("title and body required", cors);
      const { error } = await client.from("announcements").insert({
        title,
        body: text,
        type,
        is_active: true,
        admin_user_id: null,
      });
      if (error) throw error;
      return json({ success: true }, 200, cors);
    }

    if (body.action === "deactivate") {
      const id = String((body as any).id ?? "").trim();
      if (!id) return validationErrorResponse("id required", cors);
      const { error } = await client.from("announcements").update({ is_active: false }).eq("id", id);
      if (error) throw error;
      return json({ success: true }, 200, cors);
    }

    if (body.action === "delete") {
      const id = String((body as any).id ?? "").trim();
      if (!id) return validationErrorResponse("id required", cors);
      const { error } = await client.from("announcements").delete().eq("id", id);
      if (error) throw error;
      return json({ success: true }, 200, cors);
    }

    if (body.action === "list_notification_log") {
      const limit = Math.max(1, Math.min(Number((body as any).limit ?? 50), 200));
      const { data, error } = await client.from("notification_log").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return json({ success: true, log: data ?? [] }, 200, cors);
    }

    return validationErrorResponse("Invalid action", cors);
  } catch (err) {
    return safeErrorResponse(err, "[admin-announcements-control]", cors);
  }
});

