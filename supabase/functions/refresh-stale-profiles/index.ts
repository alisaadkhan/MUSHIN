import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";

// Internal cron worker — never called from browser. No CORS headers needed.
const internalHeaders = { "Content-Type": "application/json" };

// Called by pg_cron daily. Queues enrichment jobs for profiles stale > 30 days.
// Only re-enriches the top 20 by follower count to control Apify costs.

Deno.serve(async (req: Request) => {
    // Internal cron worker — no CORS preflight handled
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: internalHeaders
        });
    }

    try {

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get top profiles by follower count that are > 30 days stale
    const { data: staleProfiles, error } = await serviceClient
        .from("influencer_profiles")
        .select("id, platform, username, primary_niche, follower_count")
        .lt("enriched_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .eq("enrichment_status", "success")
        .order("follower_count", { ascending: false })
        .limit(20);

    if (error) {
        return new Response(JSON.stringify({ error: "Failed to query stale profiles" }), {
            status: 500, headers: internalHeaders
        });
    }

    if (!staleProfiles || staleProfiles.length === 0) {
        return new Response(JSON.stringify({ message: "No stale profiles found", queued: 0 }), {
            headers: internalHeaders
        });
    }

    // Queue enrichment jobs — use a dummy workspace for system-triggered refreshes
    // These don't deduct user credits (system maintenance)
    let queued = 0;
    for (const profile of staleProfiles) {
        const { error: qErr } = await serviceClient
            .from("enrichment_jobs")
            .upsert({
                workspace_id: "00000000-0000-0000-0000-000000000000", // system workspace
                user_id: "00000000-0000-0000-0000-000000000000",
                platform: profile.platform,
                username: profile.username,
                primary_niche: profile.primary_niche,
                status: "queued",
                next_attempt_at: new Date().toISOString(),
            }, {
                onConflict: "platform,username,workspace_id",
                ignoreDuplicates: true
            });

        if (!qErr) queued++;
    }

    console.log(`[stale-refresh] Queued ${queued} profiles for re-enrichment`);

    return new Response(JSON.stringify({
        found_stale: staleProfiles.length,
        queued,
    }), {
        headers: internalHeaders
    });
    } catch (err: any) {
        return safeErrorResponse(err, "[refresh-stale-profiles]", internalHeaders);
    }
});
