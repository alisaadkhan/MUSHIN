import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, isSuperAdmin, requireJwt } from "../_shared/privileged_gateway.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body = { flag_id?: string; status?: "open" | "reviewed"; reason?: string };

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
    const flagId = String(body.flag_id ?? "").trim();
    const status = body.status ?? "reviewed";
    if (!flagId) return validationErrorResponse("flag_id required", cors);
    if (!["open", "reviewed"].includes(status)) return validationErrorResponse("status invalid", cors);
    const reason = reqReason(body.reason);

    const client = createPrivilegedClient();
    const patch: Record<string, unknown> = { status };
    if (status === "reviewed") {
      patch.reviewed_at = new Date().toISOString();
      patch.reviewed_by = actorUserId;
      patch.reviewed_reason = reason;
    } else {
      patch.reviewed_at = null;
      patch.reviewed_by = null;
      patch.reviewed_reason = null;
    }

    const { data, error } = await client.from("security_flags").update(patch).eq("id", flagId).select("id,status").single();
    if (error) throw error;

    await logAdminAction({
      actorUserId,
      actionType: "superadmin:security_flags:update_status",
      actionDescription: "Super admin updated security flag status",
      ipAddress,
      userAgent,
      metadata: { flag_id: flagId, status, reason },
    });

    return json({ success: true, flag: data }, 200, cors);
  } catch (err) {
    return safeErrorResponse(err, "[update-security-flag-status]", cors);
  }
});

