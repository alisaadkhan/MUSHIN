import { createPrivilegedClient, requireJwt } from "../_shared/privileged_gateway.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const ALLOWED_PREVIEW_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_PREVIEW_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  let isVercel = false;
  try {
    const host = new URL(origin).hostname;
    isVercel = host === "vercel.app" || host.endsWith(".vercel.app");
  } catch {
    isVercel = false;
  }
  const allowed = new Set<string>([
    APP_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    // Common local dev / preview ports
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...ALLOWED_PREVIEW_ORIGINS,
  ]);

  return {
    "Access-Control-Allow-Origin": allowed.has(origin) || isVercel ? origin : APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

const ALLOWED_ROLES = ["super_admin", "system_admin", "admin", "support"] as const;
const ROLE_RANK: Record<string, number> = {
    super_admin: 1,
    system_admin: 2,
    admin: 3,
    support: 4,
    viewer: 5,
    user: 6,
};

function pickHighestRole(roles: string[]): string {
    const sorted = roles
        .filter(Boolean)
        .sort((a, b) => (ROLE_RANK[a] ?? 999) - (ROLE_RANK[b] ?? 999));
    return sorted[0] ?? "user";
}

Deno.serve(async (req) => {
    const corsHeaders = buildCorsHeaders(req);
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
        const { userId } = await requireJwt(authHeader);
        const serviceClient = createPrivilegedClient();

        // Check caller role (allow multiple rows in user_roles)
        const { data: callerRoles, error: callerRoleErr } = await serviceClient
            .from("user_roles")
            .select("role, revoked_at")
            .eq("user_id", userId)
            .is("revoked_at", null);
        if (callerRoleErr) throw callerRoleErr;

        const callerRoleList = (callerRoles ?? []).map((r: any) => String(r.role));
        const hasAccess = callerRoleList.some((r) => (ALLOWED_ROLES as readonly string[]).includes(r));
        if (!hasAccess) {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // List all users from auth
        const { data: authUsers, error: authUsersErr } = await serviceClient.auth.admin.listUsers();
        if (authUsersErr) throw authUsersErr;

        // Fetch all profiles + roles + workspaces
        const [profilesRes, rolesRes, workspacesRes] = await Promise.all([
            serviceClient.from("profiles").select("*"),
            serviceClient.from("user_roles").select("user_id, role, revoked_at"),
            serviceClient.from("workspaces").select("owner_id, plan, name"),
        ]);

        const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
        const workspaceMap = Object.fromEntries((workspacesRes.data || []).map((w: any) => [w.owner_id, w]));

        // roleMap must handle multiple roles per user (and revoked roles)
        const rolesByUser: Record<string, string[]> = {};
        for (const row of rolesRes.data ?? []) {
            if (row.revoked_at) continue;
            const uid = String(row.user_id);
            if (!rolesByUser[uid]) rolesByUser[uid] = [];
            rolesByUser[uid].push(String(row.role));
        }

        const users = authUsers.users.map((u: any) => ({
            id: u.id,
            email: u.email,
            full_name: profileMap[u.id]?.full_name ?? null,
            created_at: u.created_at,
            role: pickHighestRole(rolesByUser[u.id] ?? []),
            plan: workspaceMap[u.id]?.plan ?? "pro",
            suspended: u.banned_until ? new Date(u.banned_until) > new Date() : false,
            last_sign_in: u.last_sign_in_at ?? null,
        }));

        return new Response(JSON.stringify({ users }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return safeErrorResponse(err, "[admin-list-users]", corsHeaders);
    }
});
