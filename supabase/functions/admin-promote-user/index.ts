import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getCallerRole(serviceClient: any, userId: string): Promise<string | null> {
    const { data } = await serviceClient.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    return data?.role ?? null;
}

async function logAction(serviceClient: any, adminId: string, action: string, targetId: string, details: object) {
    await serviceClient.from("admin_audit_log").insert({ admin_user_id: adminId, action, target_user_id: targetId, details });
}

const VALID_ROLES = ["super_admin", "admin", "support", "viewer", "user"];

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const callerRole = await getCallerRole(serviceClient, user.id);
    if (!callerRole || !["super_admin", "admin"].includes(callerRole)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
        const { target_user_id, new_role } = await req.json();
        if (!target_user_id || !new_role) {
            return new Response(JSON.stringify({ error: "target_user_id and new_role required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (!VALID_ROLES.includes(new_role)) {
            return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Only super_admin can promote to super_admin
        if (new_role === "super_admin" && callerRole !== "super_admin") {
            return new Response(JSON.stringify({ error: "Only super_admin can promote users to super_admin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Upsert user_roles
        const { data: existing } = await serviceClient
            .from("user_roles")
            .select("id")
            .eq("user_id", target_user_id)
            .maybeSingle();

        if (existing) {
            await serviceClient.from("user_roles").update({ role: new_role }).eq("user_id", target_user_id);
        } else {
            await serviceClient.from("user_roles").insert({ user_id: target_user_id, role: new_role });
        }

        await logAction(serviceClient, user.id, "promote_user", target_user_id, { new_role });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
