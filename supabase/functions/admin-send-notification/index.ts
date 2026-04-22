import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { requireSystemAdmin, createPrivilegedClientWithAuth } from "../_shared/privileged_gateway.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";

function json(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(corsHeaders, { error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    await requireSystemAdmin(authHeader);
    const body = await req.json().catch(() => ({}));

    const title = String(body.p_title ?? body.title ?? "").trim();
    const msg = String(body.p_body ?? body.body ?? "").trim();
    const type = String(body.p_type ?? body.type ?? "info").trim();
    const link = body.p_link ?? body.link ?? null;
    const targetType = String(body.p_target_type ?? body.target_type ?? "all").trim();
    const targetValue = body.p_target_value ?? body.target_value ?? null;

    if (!title || !msg) return validationErrorResponse("title and body are required", corsHeaders);

    // Important: admin_send_notification checks auth.uid(), so we must carry caller JWT
    // even though we use the service role key for DB access.
    const client = createPrivilegedClientWithAuth(String(authHeader));
    const { data, error } = await client.rpc("admin_send_notification", {
      p_title: title,
      p_body: msg,
      p_type: type,
      p_link: typeof link === "string" && link.trim() ? link.trim() : null,
      p_target_type: targetType,
      p_target_value: typeof targetValue === "string" && targetValue.trim() ? targetValue.trim() : null,
    });
    if (error) throw error;

    return json(corsHeaders, { success: true, result: data ?? null });
  } catch (err) {
    return safeErrorResponse(err, "[admin-send-notification]", corsHeaders);
  }
});

