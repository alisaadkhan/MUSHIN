// Never fall back to wildcard — if APP_URL is not configured fail safe to production URL
const ALLOWED_ORIGIN = Deno.env.get("APP_URL") || "https://mushin.app";
export const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { getSecret } from "./secrets.ts";

// supabase/functions/_shared/rate_limit.ts
// Per-IP rate limiting with sliding windows for multiple time horizons.
// Protects: signup (5/min, 20/hour), login (10/min, 50/hour),
//           search (30/min, 100/hour), enrich (10/min, 30/hour), evaluate (20/min, 60/hour)

type Action = 'signup' | 'login' | 'search' | 'enrich' | 'evaluate' | 'checkout' | 'webhook' | 'general';

const LIMITS: Record<Action, { perMin: number; perHour: number }> = {
    signup:   { perMin: 5,   perHour: 20   },
    login:    { perMin: 10,  perHour: 50   },
    search:   { perMin: 30,  perHour: 100  },
    enrich:   { perMin: 10,  perHour: 30   },
    evaluate: { perMin: 20,  perHour: 60   },
    checkout: { perMin: 5,   perHour: 10   },  // Billing abuse prevention
    webhook:  { perMin: 100, perHour: 2000 },  // Paddle webhook receiver
    general:  { perMin: 60,  perHour: 300  },
};

export async function checkRateLimit(
    subjectId: string,
    action: Action = 'general',
    options?: { perMin?: number; perHour?: number; isWorkspace?: boolean }
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {

    const url = getSecret('UPSTASH_REDIS_REST_URL', { endpoint: '_shared/rate_limit', required: false });
    const token = getSecret('UPSTASH_REDIS_REST_TOKEN', { endpoint: '_shared/rate_limit', required: false });

    if (!url || !token) {
        // SECURITY: Fail CLOSED — never allow unlimited traffic when the rate-limit
        // backend is unconfigured. An open fail-open here turns a misconfiguration
        // into a complete bypass of all rate limits across every endpoint.
        // In local development, set UPSTASH_REDIS_REST_URL and TOKEN via `supabase secrets set`.
        const isDev = Deno.env.get("ENVIRONMENT") === "development";
        if (isDev) {
            console.warn("[rate_limit] Redis not configured — skipping rate limit in dev mode");
            return { allowed: true, remaining: 999 };
        }
        console.error("[rate_limit] UPSTASH_REDIS_REST_URL/TOKEN not configured — blocking request (fail CLOSED)");
        return { allowed: false, remaining: 0, retryAfter: 60 };
    }

    const limits = {
        perMin: options?.perMin ?? LIMITS[action].perMin,
        perHour: options?.perHour ?? LIMITS[action].perHour,
    };

    const scope = options?.isWorkspace ? 'workspace' : 'ip';
    const keySubject = (subjectId || 'unknown').trim() || 'unknown';

    const now = Math.floor(Date.now() / 1000);
    const minKey = `rl:${scope}:${action}:${keySubject}:min:${Math.floor(now / 60)}`;
    const hourKey = `rl:${scope}:${action}:${keySubject}:hr:${Math.floor(now / 3600)}`;

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

export function tooManyRequests(retryAfterSeconds: number, headers: Record<string, string> = corsHeaders): Response {
    const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds || 60));
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
            ...headers,
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
        },
    });
}
