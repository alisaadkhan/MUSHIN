import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, isSuperAdmin, requireJwt } from "../_shared/privileged_gateway.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body =
  | { action: "list" }
  | { action: "create"; name: string; reason: string }
  | { action: "revoke"; name: string; reason: string };

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
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 10, perHour: 60 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    if (!(await isSuperAdmin(actorUserId))) return json({ error: "Forbidden" }, 403, cors);

    const body = (await req.json().catch(() => ({}))) as Body;
    const client = createPrivilegedClient();

    if (body.action === "list") {
      const { data, error } = await client
        .from("system_api_keys")
        .select("id,name,created_by,created_at,revoked_at,revoked_by,revoked_reason")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ success: true, keys: data ?? [] }, 200, cors);
    }

    if (body.action === "create") {
      const name = String(body.name ?? "").trim();
      if (name.length < 3) return validationErrorResponse("name must be at least 3 characters", cors);
      const reason = reqReason(body.reason);

      const { data, error } = await client.rpc("create_system_api_key", { p_name: name, p_reason: reason });
      if (error) throw error;

      await logAdminAction({
        actorUserId,
        actionType: "superadmin:api_keys:create",
        actionDescription: "Super admin created system API key (plaintext returned once)",
        ipAddress,
        userAgent,
        metadata: { name },
      });

      // SECURITY: This returns plaintext once; UI must display and never store it.
      return json({ success: true, result: data }, 200, cors);
    }

    if (body.action === "revoke") {
      const name = String(body.name ?? "").trim();
      if (!name) return validationErrorResponse("name required", cors);
      const reason = reqReason(body.reason);
      const { data, error } = await client.rpc("revoke_system_api_key", { p_name: name, p_reason: reason });
      if (error) throw error;

      await logAdminAction({
        actorUserId,
        actionType: "superadmin:api_keys:revoke",
        actionDescription: "Super admin revoked system API key",
        ipAddress,
        userAgent,
        metadata: { name, reason },
      });
      return json({ success: true, revoked: Boolean(data) }, 200, cors);
    }

    return validationErrorResponse("Invalid action", cors);
  } catch (err) {
    return safeErrorResponse(err, "[superadmin-api-keys]", cors);
  }
});

