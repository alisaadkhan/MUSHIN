import { buildCorsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse, validationErrorResponse } from "../_shared/errors.ts";
import { createPrivilegedClient, requireJwt } from "../_shared/privileged_gateway.ts";

type Body = { impersonation_session_id?: string };

function json(body: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  try {
    const { userId } = await requireJwt(authHeader);
    const body = (await req.json().catch(() => ({}))) as Body;
    const id = String(body.impersonation_session_id ?? "").trim();
    if (!id) return validationErrorResponse("impersonation_session_id required", cors);

    const client = createPrivilegedClient();
    const { data, error } = await client
      .from("impersonation_sessions")
      .select("id,support_user_id,target_user_id,created_at,expires_at,revoked_at")
      .eq("id", id)
      .single();
    if (error) throw error;

    // SECURITY: only the target user (impersonated session) or super_admin can see it.
    if (data.target_user_id !== userId) {
      return json({ error: "Forbidden" }, 403, cors);
    }

    const now = Date.now();
    const exp = new Date(data.expires_at).getTime();
    const active = !data.revoked_at && exp > now;

    return json(
      {
        success: true,
        active,
        id: data.id,
        support_user_id: data.support_user_id,
        target_user_id: data.target_user_id,
        created_at: data.created_at,
        expires_at: data.expires_at,
        revoked_at: data.revoked_at,
      },
      200,
      cors,
    );
  } catch (err) {
    return safeErrorResponse(err, "[impersonation-status]", cors);
  }
});

