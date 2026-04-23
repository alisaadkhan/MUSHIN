import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClientWithAuth, requireJwt } from "../_shared/privileged_gateway.ts";
import { logUserAction } from "../_shared/audit_logger.ts";
import { checkRateLimit, corsHeaders as fixedCorsHeaders } from "../_shared/rate_limit.ts";
import { extractClientIp } from "../_shared/security.ts";

type ListBody = { action: "list"; status?: string | null; limit?: number };
type ListByUserBody = { action: "list_by_user"; user_id: string; limit?: number };
type MessagesBody = { action: "messages"; ticket_id: string };
type UpdateBody = { action: "update"; ticket_id: string; updates: Record<string, unknown>; reason?: string };
type PostMessageBody = {
  action: "post_message";
  ticket_id: string;
  visibility: "user" | "internal";
  body: string;
};

type Body = ListBody | ListByUserBody | MessagesBody | UpdateBody | PostMessageBody;

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  const ipAddress = extractClientIp(req.headers.get("x-forwarded-for"));
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  try {
    const rate = await checkRateLimit(ipAddress, "general", { perMin: 60, perHour: 600 });
    if (!rate.allowed) return json({ error: "Too many requests" }, 429, fixedCorsHeaders);

    const { userId: actorUserId } = await requireJwt(authHeader);
    const body = (await req.json().catch(() => ({}))) as Body;
    const authedPriv = createPrivilegedClientWithAuth(authHeader ?? "");

    // Pull permissions from DB (tier-gated), not from client.
    const { data: perms, error: permsErr } = await authedPriv.rpc("get_my_support_permissions");
    if (permsErr) throw permsErr;

    const canViewTickets = Boolean((perms as any)?.canViewTickets);
    const canAssignTickets = Boolean((perms as any)?.canAssignTickets);
    const canWriteInternalNotes = Boolean((perms as any)?.canWriteInternalNotes);

    if (body.action === "list") {
      if (!canViewTickets) return json({ error: "Forbidden" }, 403, cors);
      const limit = Math.max(1, Math.min(Number(body.limit ?? 200), 200));
      const status = body.status ? asString(body.status) : null;

      let q = authedPriv
        .from("support_tickets")
        .select(
          "id,ticket_number,user_id,subject,description,category,priority,status,admin_notes,assigned_to,assigned_at,created_at,updated_at,profiles!user_id(full_name,avatar_url)",
        )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (status && status !== "all") q = q.eq("status", status);

      const { data, error } = await q;
      if (error) throw error;

      await logUserAction({
        actorUserId,
        actionType: "support:tickets:list",
        actionDescription: "Support listed tickets via support panel API",
        ipAddress,
        userAgent,
        metadata: { status, limit, count: Array.isArray(data) ? data.length : 0 },
      });

      return json({ success: true, tickets: data ?? [] }, 200, cors);
    }

    if (body.action === "list_by_user") {
      if (!canViewTickets) return json({ error: "Forbidden" }, 403, cors);
      const userId = asString((body as any).user_id).trim();
      if (!userId) return validationErrorResponse("user_id required", cors);
      const limit = Math.max(1, Math.min(Number((body as any).limit ?? 50), 200));

      const { data, error } = await authedPriv
        .from("support_tickets")
        .select(
          "id,ticket_number,user_id,subject,description,category,priority,status,admin_notes,assigned_to,assigned_at,created_at,updated_at,profiles!user_id(full_name,avatar_url)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      await logUserAction({
        actorUserId,
        actionType: "support:tickets:list_by_user",
        actionDescription: "Support listed tickets for a target user via support panel API",
        ipAddress,
        userAgent,
        metadata: { user_id: userId, limit, count: Array.isArray(data) ? data.length : 0 },
      });

      return json({ success: true, tickets: data ?? [] }, 200, cors);
    }

    if (body.action === "messages") {
      if (!canViewTickets) return json({ error: "Forbidden" }, 403, cors);
      const ticketId = asString(body.ticket_id).trim();
      if (!ticketId) return validationErrorResponse("ticket_id required", cors);

      const { data, error } = await authedPriv
        .from("support_messages")
        .select("id,ticket_id,author_id,visibility,body,created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;

      await logUserAction({
        actorUserId,
        actionType: "support:tickets:messages",
        actionDescription: "Support fetched ticket messages via support panel API",
        ipAddress,
        userAgent,
        metadata: { ticket_id: ticketId, count: Array.isArray(data) ? data.length : 0 },
      });

      return json({ success: true, messages: data ?? [] }, 200, cors);
    }

    if (body.action === "update") {
      if (!canViewTickets) return json({ error: "Forbidden" }, 403, cors);
      const ticketId = asString(body.ticket_id).trim();
      if (!ticketId) return validationErrorResponse("ticket_id required", cors);

      const updates = body.updates ?? {};
      const safeUpdates: Record<string, unknown> = {};

      // SECURITY: explicit allowlist (never accept arbitrary updates from client).
      if ("status" in updates) safeUpdates.status = asString((updates as any).status);
      if ("assigned_to" in updates) {
        if (!canAssignTickets) return json({ error: "Forbidden" }, 403, cors);
        safeUpdates.assigned_to = (updates as any).assigned_to ?? null;
        safeUpdates.assigned_at = (updates as any).assigned_to ? new Date().toISOString() : null;
      }
      if ("admin_notes" in updates) {
        if (!canWriteInternalNotes) return json({ error: "Forbidden" }, 403, cors);
        safeUpdates.admin_notes = (updates as any).admin_notes ?? null;
      }

      if (Object.keys(safeUpdates).length === 0) return validationErrorResponse("No allowed updates provided", cors);

      const { error } = await authedPriv.from("support_tickets").update(safeUpdates).eq("id", ticketId);
      if (error) throw error;

      await logUserAction({
        actorUserId,
        actionType: "support:tickets:update",
        actionDescription: "Support updated ticket via support panel API",
        ipAddress,
        userAgent,
        metadata: { ticket_id: ticketId, updates: Object.keys(safeUpdates), reason: body.reason ?? null },
      });

      return json({ success: true }, 200, cors);
    }

    if (body.action === "post_message") {
      if (!canViewTickets) return json({ error: "Forbidden" }, 403, cors);
      const ticketId = asString(body.ticket_id).trim();
      if (!ticketId) return validationErrorResponse("ticket_id required", cors);

      const visibility = body.visibility;
      const text = asString(body.body).trim();
      if (!text) return validationErrorResponse("body required", cors);
      if (text.length > 5000) return validationErrorResponse("body too long", cors);

      if (visibility === "internal" && !canWriteInternalNotes) return json({ error: "Forbidden" }, 403, cors);

      const { error } = await authedPriv.from("support_messages").insert({
        ticket_id: ticketId,
        author_id: actorUserId,
        visibility,
        body: text,
      });
      if (error) throw error;

      await logUserAction({
        actorUserId,
        actionType: "support:tickets:post_message",
        actionDescription: "Support posted ticket message via support panel API",
        ipAddress,
        userAgent,
        metadata: { ticket_id: ticketId, visibility, length: text.length },
      });

      return json({ success: true }, 200, cors);
    }

    return validationErrorResponse("Invalid action", cors);
  } catch (err) {
    return safeErrorResponse(err, "[support-tickets]", cors);
  }
});

