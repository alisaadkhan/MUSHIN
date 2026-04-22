import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { requireSystemAdmin, createPrivilegedClient, sanitizeUuid } from "../_shared/privileged_gateway.ts";
import { appendSystemAuditLog } from "../_shared/audit_logger.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userId: adminId } = await requireSystemAdmin(req.headers.get("Authorization"));
    const body = await req.json().catch(() => ({}));
    const targetUserId = String(body.userId ?? "");
    const limit = Math.min(Math.max(Number(body.limit ?? 200), 1), 1000);

    if (!sanitizeUuid(targetUserId)) {
      return new Response(JSON.stringify({ error: "Invalid userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = createPrivilegedClient();
    const { data, error } = await client
      .from("user_activity_logs")
      .select("id,user_id,workspace_id,action_type,status,metadata,ip_address,device_info,created_at")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[admin-get-activity-log] select error:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch activity logs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort audit log
    try {
      await appendSystemAuditLog(client, {
        actor_id: adminId,
        action_type: "view_user_activity_log",
        target_user_id: targetUserId,
        details: { fetched_count: (data ?? []).length },
      });
    } catch (e) {
      console.error("[admin-get-activity-log] audit log failed:", e);
    }

    return new Response(JSON.stringify({ logs: data ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

