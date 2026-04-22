import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { requireSystemAdmin, createPrivilegedClient } from "../_shared/privileged_gateway.ts";
import { appendSystemAuditLog } from "../_shared/audit_logger.ts";
import { UAParser } from "npm:ua-parser-js";

serve(async (req) => {
    const corsHeaders = buildCorsHeaders(req);
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { userId: adminId } = await requireSystemAdmin(req.headers.get("Authorization"));
        const body = await req.json();
        const targetUserId = body.userId;

        if (!targetUserId) {
            return new Response(JSON.stringify({ error: "Missing userId" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const privilegedClient = createPrivilegedClient();

        // Query the new RPC function
        const { data: sessions, error } = await privilegedClient.rpc("admin_get_user_sessions", {
            p_user_id: targetUserId
        });

        if (error) {
            console.error("RPC Error:", error);
            return new Response(JSON.stringify({ error: "Failed to fetch sessions. Ensure SQL migration 20260422000000_admin_get_user_sessions.sql is applied in your Supabase dashboard." }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Parse user agents into readable devices
        const parsedSessions = (sessions || []).map((session: any) => {
            const parser = new UAParser(session.user_agent || "");
            const browser = parser.getBrowser();
            const os = parser.getOS();
            const device = parser.getDevice();
            
            let deviceName = "Unknown Device";
            if (browser.name && os.name) {
                deviceName = `${browser.name} on ${os.name}`;
            } else if (session.user_agent) {
                deviceName = "Other Browser";
            }

            return {
                id: session.id,
                created_at: session.created_at,
                updated_at: session.updated_at,
                ip: session.ip || "Unknown IP",
                device: deviceName,
                raw_user_agent: session.user_agent
            };
        });

        // Audit log (silently handled if it fails, via our previous fix pattern)
        try {
            await appendSystemAuditLog(privilegedClient, {
                actor_id: adminId,
                action_type: "view_user_sessions",
                target_user_id: targetUserId,
                details: { fetched_count: parsedSessions.length }
            });
        } catch (e) {
            console.error("Audit log failed (view sessions)", e);
        }

        return new Response(JSON.stringify({ sessions: parsedSessions }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
