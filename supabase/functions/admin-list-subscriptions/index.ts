import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createPrivilegedClient, requireSystemAdmin, sanitizeUuid } from "../_shared/privileged_gateway.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

function json(corsHeaders: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SubscriptionRow = {
  id: string;
  workspace_id: string;
  plan: string;
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  created_at: string;
  updated_at: string;
};

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json(corsHeaders, { error: "Method not allowed" }, 405);

  try {
    await requireSystemAdmin(req.headers.get("Authorization"));
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200), 1), 1000);
    const workspaceId = url.searchParams.get("workspace_id");
    const activeOnly = url.searchParams.get("active_only");
    const onlyActive = activeOnly == null ? true : activeOnly !== "0" && activeOnly !== "false";

    const client = createPrivilegedClient();

    let q = client
      .from("subscriptions")
      .select(
        "id,workspace_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_start,current_period_end,cancel_at_period_end,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (workspaceId && sanitizeUuid(workspaceId)) q = q.eq("workspace_id", workspaceId);
    if (onlyActive) q = q.eq("status", "active");

    const { data: subs, error: subErr } = await q;
    if (subErr) throw subErr;

    const wsIds = Array.from(new Set((subs ?? []).map((s) => s.workspace_id).filter(Boolean)));
    const { data: workspaces } = wsIds.length
      ? await client.from("workspaces").select("id,name,owner_id,plan,created_at").in("id", wsIds)
      : { data: [] as any[] };

    const workspaceById = new Map<string, any>((workspaces ?? []).map((w: any) => [w.id, w]));
    const ownerIds = Array.from(new Set((workspaces ?? []).map((w: any) => w.owner_id).filter(Boolean)));

    const { data: profiles } = ownerIds.length
      ? await client.from("profiles").select("id,full_name,email").in("id", ownerIds)
      : { data: [] as any[] };
    const profileById = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

    // Enrich with auth email + metadata (country) via Admin API (best-effort)
    const userById = new Map<string, any>();
    const getUser = async (id: string) => {
      if (userById.has(id)) return userById.get(id);
      try {
        const { data, error } = await client.auth.admin.getUserById(id);
        if (!error) userById.set(id, data?.user ?? null);
      } catch {
        userById.set(id, null);
      }
      return userById.get(id);
    };

    await Promise.all(ownerIds.slice(0, 200).map((id) => getUser(id)));

    const rows = (subs ?? []).map((s: any) => {
      const ws = workspaceById.get(s.workspace_id) ?? null;
      const ownerId = ws?.owner_id ?? null;
      const profile = ownerId ? profileById.get(ownerId) : null;
      const authUser = ownerId ? userById.get(ownerId) : null;
      const country =
        authUser?.user_metadata?.country ??
        authUser?.user_metadata?.location?.country ??
        authUser?.app_metadata?.country ??
        null;

      const out = {
        subscription: s as SubscriptionRow,
        workspace: ws
          ? {
              id: ws.id,
              name: ws.name,
              plan: ws.plan ?? null,
              created_at: ws.created_at ?? null,
              owner_id: ws.owner_id ?? null,
            }
          : null,
        owner: ownerId
          ? {
              id: ownerId,
              email: authUser?.email ?? profile?.email ?? null,
              full_name: profile?.full_name ?? null,
              country,
            }
          : null,
      };
      return out;
    });

    return json(corsHeaders, { success: true, rows });
  } catch (err) {
    return safeErrorResponse(err, "[admin-list-subscriptions]", corsHeaders);
  }
});

