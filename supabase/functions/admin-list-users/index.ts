import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "https://mushin.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getCallerRole(serviceClient: any, userId: string): Promise<string | null> {
    const { data } = await serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
    return data?.role ?? null;
}

const ALLOWED_ROLES = ["super_admin", "admin", "support"];

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify JWT
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check role
    const callerRole = await getCallerRole(serviceClient, user.id);
    if (!callerRole || !ALLOWED_ROLES.includes(callerRole)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
        // List all users from auth
        const { data: authUsers, error: authUsersErr } = await serviceClient.auth.admin.listUsers();
        if (authUsersErr) throw authUsersErr;

        // Fetch all profiles + roles + workspaces
        const [profilesRes, rolesRes, workspacesRes] = await Promise.all([
            serviceClient.from("profiles").select("*"),
            serviceClient.from("user_roles").select("user_id, role"),
            serviceClient.from("workspaces").select("owner_id, plan, name"),
        ]);

        const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
        const roleMap = Object.fromEntries((rolesRes.data || []).map((r: any) => [r.user_id, r.role]));
        const workspaceMap = Object.fromEntries((workspacesRes.data || []).map((w: any) => [w.owner_id, w]));

        const users = authUsers.users.map((u: any) => ({
            id: u.id,
            email: u.email,
            full_name: profileMap[u.id]?.full_name ?? null,
            created_at: u.created_at,
            role: roleMap[u.id] ?? "user",
            plan: workspaceMap[u.id]?.plan ?? "free",
            suspended: u.banned_until ? new Date(u.banned_until) > new Date() : false,
        }));

        return new Response(JSON.stringify({ users }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
