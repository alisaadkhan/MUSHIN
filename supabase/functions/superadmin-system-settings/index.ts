import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, isSuperAdmin, requireJwt } from "../_shared/privileged_gateway.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body =
  | { action: "list"; include_sensitive?: boolean }
  | { action: "set"; key: string; value: unknown; is_sensitive?: boolean; reason: string };

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function reqReason(reason: unknown) {
  const r = String(reason ?? "").trim();
  if (r.length < 10) throw new Error("reason_required");
  return r.slice(0, 400);
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 20, perHour: 120 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    if (!(await isSuperAdmin(actorUserId))) return json({ error: "Forbidden" }, 403, cors);

    const body = (await req.json().catch(() => ({}))) as Body;
    const client = createPrivilegedClient();

    if (body.action === "list") {
      const includeSensitive = Boolean((body as any).include_sensitive);
      const { data, error } = await client.from("system_settings").select("key,value,is_sensitive,updated_by,updated_at").order(
        "key",
        { ascending: true },
      );
      if (error) throw error;

      const rows = (data ?? []).map((r: any) => ({
        key: r.key,
        is_sensitive: Boolean(r.is_sensitive),
        updated_by: r.updated_by,
        updated_at: r.updated_at,
        // SECURITY: sensitive values are never returned unless explicitly requested,
        // and even then this endpoint is super_admin-only.
        value: r.is_sensitive && !includeSensitive ? null : r.value,
      }));
      return json({ success: true, settings: rows }, 200, cors);
    }

    if (body.action === "set") {
      const key = String(body.key ?? "").trim();
      if (!key || key.length > 200) return validationErrorResponse("key invalid", cors);
      const reason = reqReason(body.reason);
      const isSensitive = Boolean((body as any).is_sensitive);

      const value = (body as any).value ?? {};
      const { error } = await client.from("system_settings").upsert({
        key,
        value,
        is_sensitive: isSensitive,
        updated_by: actorUserId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
      if (error) throw error;

      await logAdminAction({
        actorUserId,
        actionType: "superadmin:system_settings:set",
        actionDescription: "Super admin updated system setting",
        ipAddress,
        userAgent,
        metadata: { key, is_sensitive: isSensitive, reason },
      });

      return json({ success: true }, 200, cors);
    }

    return validationErrorResponse("Invalid action", cors);
  } catch (err) {
    return safeErrorResponse(err, "[superadmin-system-settings]", cors);
  }
});

