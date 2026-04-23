import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, isSuperAdmin, requireJwt } from "../_shared/privileged_gateway.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";

type Body = { user_id?: string };

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function asUuid(v: unknown) {
  const s = String(v ?? "").trim();
  if (!/^[0-9a-fA-F-]{36}$/.test(s)) return null;
  return s;
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 20, perHour: 200 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    if (!(await isSuperAdmin(actorUserId))) return json({ error: "Forbidden" }, 403, cors);

    const body = (await req.json().catch(() => ({}))) as Body;
    const targetUserId = asUuid(body.user_id);
    if (!targetUserId) return validationErrorResponse("user_id required", cors);

    const client = createPrivilegedClient();

    const { data: assignments, error: aErr } = await client
      .from("user_role_assignments")
      .select("role_id, revoked_at, roles(name)")
      .eq("user_id", targetUserId)
      .is("revoked_at", null);
    if (aErr) throw aErr;

    const roleIds = (assignments ?? []).map((r: any) => r.role_id).filter(Boolean);
    let permissions: string[] = [];
    if (roleIds.length) {
      const { data: rp, error: rpErr } = await client
        .from("role_permissions")
        .select("permissions(action)")
        .in("role_id", roleIds);
      if (rpErr) throw rpErr;
      const set = new Set<string>();
      for (const row of rp ?? []) {
        const action = (row as any)?.permissions?.action;
        if (action) set.add(String(action));
      }
      permissions = Array.from(set).sort((x, y) => x.localeCompare(y));
    }

    await logAdminAction({
      actorUserId,
      targetUserId,
      actionType: "superadmin:rbac:effective_permissions",
      actionDescription: "Super admin viewed a user's effective RBAC permissions",
      ipAddress,
      userAgent,
      metadata: { role_count: roleIds.length, permission_count: permissions.length },
    });

    return json(
      {
        success: true,
        user_id: targetUserId,
        roles: (assignments ?? []).map((r: any) => ({ role_id: r.role_id, name: r.roles?.name ?? null })),
        effective_permissions: permissions,
      },
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, "[superadmin-effective-permissions]", cors);
  }
});

