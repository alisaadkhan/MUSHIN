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
    await serviceClient.from("admin_audit_log").insert({
        admin_user_id: adminId,
        action,
        target_user_id: targetId,
        details,
    });
}

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
        const { target_user_id, suspend } = await req.json();
        if (!target_user_id) {
            return new Response(JSON.stringify({ error: "target_user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (suspend) {
            // Ban user for 100 years
            await serviceClient.auth.admin.updateUserById(target_user_id, {
                ban_duration: "876000h",
            });
        } else {
            // Unban
            await serviceClient.auth.admin.updateUserById(target_user_id, {
                ban_duration: "none",
            });
        }

        await logAction(serviceClient, user.id, suspend ? "suspend_user" : "unsuspend_user", target_user_id, { suspend });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
