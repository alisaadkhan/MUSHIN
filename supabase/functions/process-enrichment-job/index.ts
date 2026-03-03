import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordCircuitResult } from "../_shared/rate_limit.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

// This function is called by a pg_cron job or Supabase scheduled webhook.
// It picks up to 3 queued enrichment jobs, processes them, and marks completion.
// Safe to call concurrently — uses FOR UPDATE SKIP LOCKED to prevent double-processing.

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        // Verify the call is internal (via webhook secret)
        const secret = Deno.env.get("WEBHOOK_SECRET");
        const authHeader = req.headers.get("x-webhook-signature") || req.headers.get("Authorization");
        if (secret && authHeader !== `Bearer ${secret}`) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const serviceClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Claim up to 3 jobs atomically using raw SQL (FOR UPDATE SKIP LOCKED)
        const { data: jobs, error: claimError } = await serviceClient.rpc("claim_enrichment_jobs", { batch_size: 3 });
        if (claimError) throw claimError;
        if (!jobs || jobs.length === 0) {
            return new Response(JSON.stringify({ processed: 0, message: "No jobs queued" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const results = await Promise.allSettled(jobs.map((job: any) => processJob(job, serviceClient)));

        const processed = results.filter(r => r.status === "fulfilled").length;
        const failed = results.filter(r => r.status === "rejected").length;

        return new Response(JSON.stringify({ processed, failed, total: jobs.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err: any) {
        console.error("[queue-worker] Fatal error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});

async function processJob(job: any, serviceClient: any): Promise<void> {
    console.log(`[queue-worker] Processing job ${job.id}: ${job.platform}/${job.username}`);

    try {
        // Call enrich-influencer synchronously (the actual enrichment logic lives there)
        const enrichUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-influencer`;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // 110-second hard timeout — prevents runaway jobs blocking the queue
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 110_000);

        let res: Response;
        try {
            res = await fetch(enrichUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${serviceKey}`,
                    "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
                },
                body: JSON.stringify({
                    platform: job.platform,
                    username: job.username,
                    primary_niche: job.primary_niche,
                    force_refresh: true,
                    _from_queue: true,  // signal to skip workspace credit check (charged at queue time)
                }),
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
        }

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `Enrichment returned ${res.status}`);
        }

        // Mark job completed
        await serviceClient.from("enrichment_jobs").update({
            status: "completed",
            result: data,
            updated_at: new Date().toISOString(),
        }).eq("id", job.id);

        await recordCircuitResult("apify", true);
        console.log(`[queue-worker] Job ${job.id} completed`);

    } catch (err: any) {
        const nextAttempt = job.attempt_count + 1;
        const isDead = nextAttempt >= job.max_attempts;

        // Exponential backoff: 2min, 8min, 32min
        const backoffSec = Math.pow(4, nextAttempt) * 120;

        await serviceClient.from("enrichment_jobs").update({
            status: isDead ? "dead" : "queued",
            attempt_count: nextAttempt,
            last_error: err.message,
            next_attempt_at: isDead
                ? new Date().toISOString()
                : new Date(Date.now() + backoffSec * 1000).toISOString(),
            updated_at: new Date().toISOString(),
        }).eq("id", job.id);

        // Also mark influencer_profiles as failed
        await serviceClient.from("influencer_profiles").update({
            enrichment_status: isDead ? "failed" : "queued",
            enrichment_error: err.message,
        }).eq("platform", job.platform).eq("username", job.username);

        if (err.message?.includes("Apify") || err.message?.includes("503")) {
            await recordCircuitResult("apify", false);
        }

        console.error(`[queue-worker] Job ${job.id} failed (attempt ${nextAttempt}/${job.max_attempts}):`, err.message);
        throw err;
    }
}
