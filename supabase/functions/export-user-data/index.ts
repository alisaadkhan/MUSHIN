import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// GDPR Article 20 — Right to Data Portability
// Returns all data associated with the requesting user as a structured JSON export.

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const token = authHeader.replace("Bearer ", "");
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Collect all user data
        const [profile, membership] = await Promise.all([
            serviceClient.from("profiles").select("*").eq("id", user.id).single(),
            serviceClient.from("workspace_members").select("workspace_id, role").eq("user_id", user.id).single(),
        ]);

        let workspaceData = null;
        let campaigns = [];
        let searchHistory = [];
        let lists = [];
        let creditsUsage = [];

        if (membership.data?.workspace_id) {
            const wid = membership.data.workspace_id;
            const [ws, camp, sh, il, cu] = await Promise.all([
                serviceClient.from("workspaces").select("name, plan, search_credits_remaining, enrichment_credits_remaining, created_at").eq("id", wid).single(),
                serviceClient.from("campaigns").select("id, name, status, created_at").eq("workspace_id", wid),
                serviceClient.from("search_history").select("query, platform, result_count, created_at").eq("workspace_id", wid).order("created_at", { ascending: false }).limit(500),
                serviceClient.from("influencer_lists").select("name, created_at").eq("workspace_id", wid),
                serviceClient.from("credits_usage").select("action_type, amount, created_at").eq("workspace_id", wid).limit(1000),
            ]);
            workspaceData = ws.data;
            campaigns = camp.data || [];
            searchHistory = sh.data || [];
            lists = il.data || [];
            creditsUsage = cu.data || [];
        }

        const exportData = {
            exported_at: new Date().toISOString(),
            user: {
                id: user.id,
                email: user.email,
                created_at: user.created_at,
                last_sign_in_at: user.last_sign_in_at,
            },
            profile: profile.data,
            workspace: workspaceData,
            campaigns,
            search_history: searchHistory,
            influencer_lists: lists,
            credits_usage: creditsUsage,
        };

        // Log this export for compliance audit trail
        await serviceClient.from("admin_audit_log").insert({
            action: "gdpr_data_export",
            admin_user_id: user.id,
            details: { exported_at: exportData.exported_at, record_count: searchHistory.length + campaigns.length }
        });

        return new Response(JSON.stringify(exportData, null, 2), {
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="mushin-data-export-${user.id}.json"`,
            }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
