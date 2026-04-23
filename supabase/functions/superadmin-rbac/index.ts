import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, isSuperAdmin, requireJwt } from "../_shared/privileged_gateway.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type Body =
  | { action: "list_roles" }
  | { action: "create_role"; name: string; description?: string | null }
  | { action: "list_permissions" }
  | { action: "create_permission"; action_name: string; description?: string | null }
  | { action: "get_role_permissions"; role_id: string }
  | { action: "set_role_permissions"; role_id: string; permission_ids: string[]; reason: string }
  | { action: "list_assignments"; user_id?: string }
  | { action: "assign_role"; user_id: string; role_id: string; reason: string }
  | { action: "revoke_assignment"; assignment_id: string; reason: string };

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
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 30, perHour: 300 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    if (!(await isSuperAdmin(actorUserId))) return json({ error: "Forbidden" }, 403, cors);

    const body = (await req.json().catch(() => ({}))) as Body;
    const client = createPrivilegedClient();

    if (body.action === "list_roles") {
      const { data, error } = await client.from("roles").select("id,name,description,is_system,created_at,updated_at").order(
        "name",
        { ascending: true },
      );
      if (error) throw error;
      return json({ success: true, roles: data ?? [] }, 200, cors);
    }

    if (body.action === "create_role") {
      const name = String(body.name ?? "").trim();
      if (name.length < 3) return validationErrorResponse("name must be at least 3 characters", cors);
      const { data, error } = await client.from("roles").insert({
        name,
        description: body.description ?? null,
        is_system: false,
      }).select("id,name,description,is_system,created_at,updated_at").single();
      if (error) throw error;

      await logAdminAction({
        actorUserId,
        actionType: "superadmin:rbac:create_role",
        actionDescription: "Super admin created RBAC role",
        ipAddress,
        userAgent,
        metadata: { role_id: data?.id, name },
      });
      return json({ success: true, role: data }, 200, cors);
    }

    if (body.action === "list_permissions") {
      const { data, error } = await client.from("permissions").select("id,action,description,created_at").order("action", {
        ascending: true,
      });
      if (error) throw error;
      return json({ success: true, permissions: data ?? [] }, 200, cors);
    }

    if (body.action === "create_permission") {
      const actionName = String(body.action_name ?? "").trim();
      if (actionName.length < 3 || !actionName.includes(".")) {
        return validationErrorResponse("action_name must look like 'domain.verb'", cors);
      }
      const { data, error } = await client.from("permissions").insert({
        action: actionName,
        description: body.description ?? null,
      }).select("id,action,description,created_at").single();
      if (error) throw error;

      await logAdminAction({
        actorUserId,
        actionType: "superadmin:rbac:create_permission",
        actionDescription: "Super admin created permission",
        ipAddress,
        userAgent,
        metadata: { permission_id: data?.id, action: actionName },
      });
      return json({ success: true, permission: data }, 200, cors);
    }

    if (body.action === "get_role_permissions") {
      const roleId = String((body as any).role_id ?? "").trim();
      if (!roleId) return validationErrorResponse("role_id required", cors);
      const { data, error } = await client
        .from("role_permissions")
        .select("permission_id, permissions(action,description)")
        .eq("role_id", roleId);
      if (error) throw error;
      const perms = (data ?? []).map((r: any) => ({
        permission_id: r.permission_id,
        action: r.permissions?.action ?? null,
        description: r.permissions?.description ?? null,
      }));
      return json({ success: true, permissions: perms }, 200, cors);
    }

    if (body.action === "set_role_permissions") {
      const roleId = String(body.role_id ?? "").trim();
      if (!roleId) return validationErrorResponse("role_id required", cors);
      const reason = reqReason(body.reason);
      const ids = Array.isArray(body.permission_ids) ? body.permission_ids.map((x) => String(x).trim()).filter(Boolean) : [];

      await client.from("role_permissions").delete().eq("role_id", roleId);
      if (ids.length) {
        const rows = ids.map((pid) => ({ role_id: roleId, permission_id: pid }));
        const { error } = await client.from("role_permissions").insert(rows);
        if (error) throw error;
      }

      await logAdminAction({
        actorUserId,
        actionType: "superadmin:rbac:set_role_permissions",
        actionDescription: "Super admin updated role permissions",
        ipAddress,
        userAgent,
        metadata: { role_id: roleId, permission_ids: ids, reason },
      });
      return json({ success: true }, 200, cors);
    }

    if (body.action === "list_assignments") {
      const userId = String((body as any).user_id ?? "").trim();
      let q = client.from("user_role_assignments").select(
        "id,user_id,role_id,granted_by,granted_reason,granted_at,revoked_at,revoked_by,revoked_reason, roles(name)",
      ).order("granted_at", { ascending: false }).limit(500);
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return json({ success: true, assignments: data ?? [] }, 200, cors);
    }

    if (body.action === "assign_role") {
      const userId = String(body.user_id ?? "").trim();
      const roleId = String(body.role_id ?? "").trim();
      if (!userId) return validationErrorResponse("user_id required", cors);
      if (!roleId) return validationErrorResponse("role_id required", cors);
      const reason = reqReason(body.reason);

      const { data, error } = await client.from("user_role_assignments").upsert({
        user_id: userId,
        role_id: roleId,
        granted_by: actorUserId,
        granted_reason: reason,
        revoked_at: null,
        revoked_by: null,
        revoked_reason: null,
      }, { onConflict: "user_id,role_id" }).select("id").single();
      if (error) throw error;

      await logAdminAction({
        actorUserId,
        actionType: "superadmin:rbac:assign_role",
        actionDescription: "Super admin assigned RBAC role to user",
        targetUserId: userId,
        ipAddress,
        userAgent,
        metadata: { assignment_id: data?.id, role_id: roleId, reason },
      });

      return json({ success: true, assignment_id: data?.id }, 200, cors);
    }

    if (body.action === "revoke_assignment") {
      const assignmentId = String(body.assignment_id ?? "").trim();
      if (!assignmentId) return validationErrorResponse("assignment_id required", cors);
      const reason = reqReason(body.reason);

      const { data: row, error: upErr } = await client.from("user_role_assignments").update({
        revoked_at: new Date().toISOString(),
        revoked_by: actorUserId,
        revoked_reason: reason,
      }).eq("id", assignmentId).select("user_id,role_id").single();
      if (upErr) throw upErr;

      await logAdminAction({
        actorUserId,
        actionType: "superadmin:rbac:revoke_assignment",
        actionDescription: "Super admin revoked RBAC assignment",
        targetUserId: row?.user_id ?? null,
        ipAddress,
        userAgent,
        metadata: { assignment_id: assignmentId, role_id: row?.role_id ?? null, reason },
      });
      return json({ success: true }, 200, cors);
    }

    return validationErrorResponse("Invalid action", cors);
  } catch (err) {
    return safeErrorResponse(err, "[superadmin-rbac]", cors);
  }
});

