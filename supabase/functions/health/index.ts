import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// No auth required — public health endpoint for monitoring tools (UptimeRobot, BetterUptime).
// Returns: database connectivity, Redis connectivity, function status.

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
    }

    const checks: Record<string, { status: "ok" | "degraded" | "down"; latency_ms?: number; detail?: string }> = {};
    const t0 = Date.now();

    // 1. Database check
    try {
        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );
        const t = Date.now();
        const { error } = await serviceClient.from("workspaces").select("id").limit(1);
        checks.database = error
            ? { status: "down", detail: error.message }
            : { status: "ok", latency_ms: Date.now() - t };
    } catch (e: any) {
        checks.database = { status: "down", detail: e.message };
    }

    // 2. Redis check
    const REDIS_URL = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const REDIS_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
    if (REDIS_URL && REDIS_TOKEN) {
        try {
            const t = Date.now();
            const res = await fetch(`${REDIS_URL}/ping`, {
                headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
            });
            checks.redis = res.ok
                ? { status: "ok", latency_ms: Date.now() - t }
                : { status: "degraded", detail: `HTTP ${res.status}` };
        } catch (e: any) {
            checks.redis = { status: "down", detail: e.message };
        }
    } else {
        checks.redis = { status: "degraded", detail: "Redis not configured" };
    }

    // 3. API key presence checks (don't reveal the keys — just confirm they exist)
    checks.serper_configured = { status: Deno.env.get("SERPER_API_KEY") ? "ok" : "down" };
    checks.apify_configured = { status: Deno.env.get("APIFY_API_KEY") ? "ok" : "degraded" };
    checks.youtube_configured = { status: Deno.env.get("YOUTUBE_API_KEY") ? "ok" : "degraded" };

    const allOk = Object.values(checks).every(c => c.status === "ok" || c.status === "degraded");
    const criticalDown = checks.database?.status === "down";

    return new Response(JSON.stringify({
        status: criticalDown ? "down" : allOk ? "ok" : "degraded",
        version: "1.0.0",
        uptime_ms: Date.now() - t0,
        checks,
        timestamp: new Date().toISOString(),
    }), {
        status: criticalDown ? 503 : 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
});
