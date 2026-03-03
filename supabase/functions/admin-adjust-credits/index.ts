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
        const { target_user_id, search_credits, ai_credits, email_sends, enrichment_credits } = await req.json();
        if (!target_user_id) {
            return new Response(JSON.stringify({ error: "target_user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Get user's workspace
        const { data: workspace } = await serviceClient
            .from("workspaces")
            .select("id, search_credits_remaining, ai_credits_remaining, email_sends_remaining, enrichment_credits_remaining")
            .eq("owner_id", target_user_id)
            .single();

        if (!workspace) {
            return new Response(JSON.stringify({ error: "User workspace not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const updates: Record<string, number> = {};
        // SEC-09: clamp to 0 — negative credit balances are never valid
        if (search_credits != null) updates.search_credits_remaining = Math.max(0, workspace.search_credits_remaining + search_credits);
        if (ai_credits != null) updates.ai_credits_remaining = Math.max(0, workspace.ai_credits_remaining + ai_credits);
        if (email_sends != null) updates.email_sends_remaining = Math.max(0, workspace.email_sends_remaining + email_sends);
        if (enrichment_credits != null) updates.enrichment_credits_remaining = Math.max(0, workspace.enrichment_credits_remaining + enrichment_credits);

        if (Object.keys(updates).length === 0) {
            return new Response(JSON.stringify({ error: "No credit adjustments specified" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await serviceClient.from("workspaces").update(updates).eq("id", workspace.id);
        await logAction(serviceClient, user.id, "adjust_credits", target_user_id, { adjustments: { search_credits, ai_credits, email_sends, enrichment_credits } });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
