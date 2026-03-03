export const corsHeaders = {
    "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// supabase/functions/_shared/rate_limit.ts
// Per-IP rate limiting with sliding windows for multiple time horizons.
// Protects: search (30/min, 100/hour), enrich (10/min, 30/hour), evaluate (20/min, 60/hour)

type Action = 'search' | 'enrich' | 'evaluate' | 'general';

const LIMITS: Record<Action, { perMin: number; perHour: number }> = {
    search: { perMin: 30, perHour: 100 },
    enrich: { perMin: 10, perHour: 30 },
    evaluate: { perMin: 20, perHour: 60 },
    general: { perMin: 60, perHour: 300 },
};

export async function checkRateLimit(
    ip: string,
    action: Action = 'general',
    customLimits?: { perMin?: number; perHour?: number }
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {

    const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
    const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

    if (!url || !token) {
        console.warn("[rate_limit] UPSTASH_REDIS_REST_URL/TOKEN not configured — rate limiting disabled");
        return { allowed: true, remaining: 999 };
    }

    const limits = {
        perMin: customLimits?.perMin ?? LIMITS[action].perMin,
        perHour: customLimits?.perHour ?? LIMITS[action].perHour,
    };

    const now = Math.floor(Date.now() / 1000);
    const minKey = `rl:${action}:${ip}:min:${Math.floor(now / 60)}`;
    const hourKey = `rl:${action}:${ip}:hr:${Math.floor(now / 3600)}`;

    const res = await fetch(`${url}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
            ['INCR', minKey], ['EXPIRE', minKey, 60],
            ['INCR', hourKey], ['EXPIRE', hourKey, 3600],
        ]),
    });

    if (!res.ok) {
        console.error("[rate_limit] Redis returned non-OK:", res.status);
        // Fail CLOSED — better to block one request than to disable all rate limiting
        return { allowed: false, remaining: 0, retryAfter: 10 };
    }

    const results = await res.json();
    const minCount = results[0]?.[1] ?? 0;
    const hourCount = results[2]?.[1] ?? 0;

    if (minCount > limits.perMin) {
        return { allowed: false, remaining: 0, retryAfter: 60 - (now % 60) };
    }
    if (hourCount > limits.perHour) {
        return { allowed: false, remaining: 0, retryAfter: 3600 - (now % 3600) };
    }

    return {
        allowed: true,
        remaining: Math.min(limits.perMin - minCount, limits.perHour - hourCount),
    };
}

// ── Request ID and structured logger ──────────────────────────────────────────
export function generateRequestId(): string {
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

export function createLogger(requestId: string, fn: string) {
    const ctx = { request_id: requestId, function: fn, ts: () => new Date().toISOString() };
    return {
        info: (msg: string, data?: object) => console.log(JSON.stringify({ level: 'INFO', msg, request_id: ctx.request_id, function: ctx.fn, ...data, ts: ctx.ts() })),
        warn: (msg: string, data?: object) => console.warn(JSON.stringify({ level: 'WARN', msg, request_id: ctx.request_id, function: ctx.fn, ...data, ts: ctx.ts() })),
        error: (msg: string, data?: object) => console.error(JSON.stringify({ level: 'ERROR', msg, request_id: ctx.request_id, function: ctx.fn, ...data, ts: ctx.ts() })),
    };
}
