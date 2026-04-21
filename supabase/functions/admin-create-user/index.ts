import { performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "https://mushin.app",
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

    const serviceClient = await performPrivilegedWrite({
        authHeader,
        action: "gateway:privileged-client-bootstrap",
        execute: async (_ctx, client) => client,
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
        const { email, password, full_name, role } = await req.json();
        
        if (!email || !password || !role) {
            return new Response(JSON.stringify({ error: "email, password, and role required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (!VALID_ROLES.includes(role)) {
            return new Response(JSON.stringify({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (role === "super_admin" && callerRole !== "super_admin") {
            return new Response(JSON.stringify({ error: "Only super_admin can create users with super_admin role" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 1. Create the user using Admin API
        const { data: userData, error: createError } = await serviceClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: full_name || "" }
        });

        if (createError || !userData?.user) {
            throw createError || new Error("Failed to create user identity");
        }

        const newUserId = userData.user.id;

        // 2. Ensure profile exists and set role
        await serviceClient.from("user_roles").insert({ user_id: newUserId, role });
        
        // Wait briefly for trigger-created profile to be ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Ensure profile metadata matches
        await serviceClient.from("profiles").update({ full_name: full_name || null }).eq("id", newUserId);

        await logAction(serviceClient, user.id, "create_user", newUserId, { email, role });

        return new Response(JSON.stringify({ success: true, user: userData.user }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return safeErrorResponse(err, "[admin-create-user]", corsHeaders);
    }
});
