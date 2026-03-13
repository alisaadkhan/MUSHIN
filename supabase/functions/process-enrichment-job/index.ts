import { getServiceRoleKey } from "../_shared/privileged_gateway.ts";
import { performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordCircuitResult } from "../_shared/rate_limit.ts";
import { safeErrorResponse } from "../_shared/errors.ts";
import { consumeNonceOnce, isRecentTimestamp } from "../_shared/security.ts";
const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const corsHeaders = {
    "Access-Control-Allow-Origin": APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp, x-webhook-nonce",
};

const NONCE_STORE = new Map<string, number>();

// This function is called by a pg_cron job or Supabase scheduled webhook.
// It picks up to 3 queued enrichment jobs, processes them, and marks completion.
// Safe to call concurrently — uses FOR UPDATE SKIP LOCKED to prevent double-processing.

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
        // Fail closed: this endpoint must always be protected by WEBHOOK_SECRET.
        const secret = Deno.env.get("WEBHOOK_SECRET");
        if (!secret) {
            return new Response(JSON.stringify({ error: "Server misconfigured" }), {
                status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const authHeader = req.headers.get("x-webhook-signature") || req.headers.get("Authorization");
        if (authHeader !== `Bearer ${secret}`) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Replay protection: require a short-lived timestamp and one-time nonce.
        const timestampHeader = req.headers.get("x-webhook-timestamp");
        if (!isRecentTimestamp(timestampHeader)) {
            return new Response(JSON.stringify({ error: "Stale or missing timestamp" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const nonceHeader = req.headers.get("x-webhook-nonce");
        if (!nonceHeader || !consumeNonceOnce(NONCE_STORE, nonceHeader)) {
            return new Response(JSON.stringify({ error: "Replay detected" }), {
                status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const serviceClient = await performPrivilegedWrite({
        authHeader: req.headers.get("Authorization"),
        action: "gateway:privileged-client-bootstrap",
        execute: async (_ctx, client) => client,
    });

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
        return safeErrorResponse(err, "[queue-worker]", corsHeaders);
    }
});

async function processJob(job: any, serviceClient: any): Promise<void> {
    console.log(`[queue-worker] Processing job ${job.id}: ${job.platform}/${job.username}`);

    try {
        // Call enrich-influencer synchronously (the actual enrichment logic lives there)
        const enrichUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-influencer`;
        const serviceKey = getServiceRoleKey();

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
