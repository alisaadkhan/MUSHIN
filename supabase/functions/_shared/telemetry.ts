import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared telemetry client using Service Role to bypass RLS for logging
// This client is intentionally lazy-loaded only when logging occurs
let telemetryClient: ReturnType<typeof createClient> | null = null;

function getTelemetryClient() {
    if (!telemetryClient) {
        telemetryClient = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { persistSession: false, autoRefreshToken: false } }
        );
    }
    return telemetryClient;
}

export interface ApiUsageLogArgs {
    endpoint: string;
    request_id?: string;
    latency_ms?: number;
    status_code: number;
    user_id?: string;
    workspace_id?: string;
}

/**
 * Logs API usage securely without blocking the primary request.
 * Uses EdgeRuntime.waitUntil semantics if passing the promise, or just fire-and-forget.
 */
export function logApiUsageAsync(args: ApiUsageLogArgs): void {
    const supabase = getTelemetryClient();
    
    // Fire and forget: We don't await this so it doesn't add latency to the user response.
    // In Deno Deploy (Supabase Edge Functions), unawaited promises often finish if they are small DB inserts,
    // though strict waitUntil is better if the edge runtime supports it directly.
    supabase.from("api_usage_logs").insert({
        endpoint: args.endpoint,
        request_id: args.request_id || crypto.randomUUID(),
        latency_ms: args.latency_ms || 0,
        status_code: args.status_code,
        user_id: args.user_id || undefined,
        workspace_id: args.workspace_id || undefined,
        timestamp: new Date().toISOString()
    }).then(({ error }) => {
        if (error) {
            console.error("[telemetry] Failed to log API usage:", error.message);
        }
    }).catch((e) => {
        console.error("[telemetry] Unexpected error logging API usage:", e);
    });
}
