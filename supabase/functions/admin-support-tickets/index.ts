import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, requireSystemAdmin, requireJwt } from "../_shared/privileged_gateway.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";
import { logAdminAction } from "../_shared/audit_logger.ts";

type Body =
  | { action: "list_tickets"; status?: string | null; limit?: number }
  | { action: "list_staff" }
  | { action: "list_replies"; ticket_id: string }
  | { action: "post_reply"; ticket_id: string; body: string }
  | { action: "update_ticket"; ticket_id: string; updates: Record<string, unknown> }
  | { action: "assign"; ticket_id: string; assigned_to: string | null };

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function asString(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
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
    await requireSystemAdmin(authHeader);

    const body = (await req.json().catch(() => ({}))) as Body;
    const client = createPrivilegedClient();

    if (body.action === "list_tickets") {
      const status = asString((body as any).status).trim() || null;
      const limit = Math.max(1, Math.min(Number((body as any).limit ?? 200), 500));

      let q = client
        .from("support_tickets")
        .select("*, profiles!user_id(full_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) q = q.eq("status", status);

      const { data, error } = await q;
      if (error) throw error;

      await logAdminAction({
        actorUserId,
        actionType: "admin:support_tickets:list",
        actionDescription: "Admin listed support tickets",
        ipAddress,
        userAgent,
        metadata: { status, limit, count: Array.isArray(data) ? data.length : 0 },
      });

      return json({ success: true, tickets: data ?? [] }, 200, cors);
    }

    if (body.action === "list_staff") {
      const { data: roles, error } = await client
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["support", "admin", "super_admin"])
        .is("revoked_at", null);
      if (error) throw error;

      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id).filter(Boolean)));
      if (ids.length === 0) return json({ success: true, staff: [] }, 200, cors);

      const { data: profiles, error: pErr } = await client.from("profiles").select("id, full_name").in("id", ids);
      if (pErr) throw pErr;

      return json({ success: true, staff: profiles ?? [] }, 200, cors);
    }

    if (body.action === "list_replies") {
      const ticketId = asString((body as any).ticket_id).trim();
      if (!ticketId) return validationErrorResponse("ticket_id required", cors);

      const { data, error } = await client
        .from("support_ticket_replies")
        .select("id,ticket_id,author_id,is_admin,body,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;

      return json({ success: true, replies: data ?? [] }, 200, cors);
    }

    if (body.action === "post_reply") {
      const ticketId = asString((body as any).ticket_id).trim();
      const text = asString((body as any).body).trim();
      if (!ticketId) return validationErrorResponse("ticket_id required", cors);
      if (!text) return validationErrorResponse("body required", cors);

      const { error } = await client.from("support_ticket_replies").insert({
        ticket_id: ticketId,
        author_id: actorUserId,
        is_admin: true,
        body: text,
      });
      if (error) throw error;

      // Best-effort: auto move open -> in_progress
      try {
        await client.from("support_tickets").update({ status: "in_progress" }).eq("id", ticketId).eq("status", "open");
      } catch {
        // ignore
      }

      await logAdminAction({
        actorUserId,
        actionType: "admin:support_tickets:reply",
        actionDescription: "Admin replied to support ticket",
        ipAddress,
        userAgent,
        metadata: { ticket_id: ticketId },
      });

      return json({ success: true }, 200, cors);
    }

    if (body.action === "update_ticket") {
      const ticketId = asString((body as any).ticket_id).trim();
      const updates = ((body as any).updates ?? {}) as Record<string, unknown>;
      if (!ticketId) return validationErrorResponse("ticket_id required", cors);

      // Allowlist
      const safe: Record<string, unknown> = {};
      for (const k of ["status", "admin_notes", "resolved_at", "priority", "category"] as const) {
        if (k in updates) safe[k] = updates[k];
      }
      if (Object.keys(safe).length === 0) return validationErrorResponse("no_allowed_updates", cors);

      const { error } = await client.from("support_tickets").update(safe).eq("id", ticketId);
      if (error) throw error;

      await logAdminAction({
        actorUserId,
        actionType: "admin:support_tickets:update",
        actionDescription: "Admin updated support ticket",
        ipAddress,
        userAgent,
        metadata: { ticket_id: ticketId, updates: Object.keys(safe) },
      });

      return json({ success: true }, 200, cors);
    }

    if (body.action === "assign") {
      const ticketId = asString((body as any).ticket_id).trim();
      const assignedTo = (body as any).assigned_to ? asString((body as any).assigned_to).trim() : null;
      if (!ticketId) return validationErrorResponse("ticket_id required", cors);

      const { error } = await client
        .from("support_tickets")
        .update({ assigned_to: assignedTo, assigned_at: assignedTo ? new Date().toISOString() : null })
        .eq("id", ticketId);
      if (error) throw error;

      await logAdminAction({
        actorUserId,
        actionType: "admin:support_tickets:assign",
        actionDescription: "Admin assigned support ticket",
        ipAddress,
        userAgent,
        metadata: { ticket_id: ticketId, assigned_to: assignedTo },
      });

      return json({ success: true }, 200, cors);
    }

    return validationErrorResponse("Invalid action", cors);
  } catch (err) {
    return safeErrorResponse(err, "[admin-support-tickets]", cors);
  }
});

