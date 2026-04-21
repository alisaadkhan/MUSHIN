type UpstashResponse<T> = { result?: T; error?: string };

const UPSTASH_URL = Deno.env.get("UPSTASH_REDIS_REST_URL")?.replace(/\/$/, "") ?? "";
const UPSTASH_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ?? "";

function upstashEnabled(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

async function upstashPost<T>(path: string): Promise<UpstashResponse<T>> {
  const res = await fetch(`${UPSTASH_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
    },
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as UpstashResponse<T>;
  } catch {
    return { error: `Invalid Upstash response (${res.status}): ${text.slice(0, 200)}` };
  }
}

/**
 * Validates request against Redis rate limits.
 * @param identifier User ID or IP Address to rate limit.
 * @param category E.g., 'ai-generation', 'email-send'
 * @param maxRequests Maximum requests allowed.
 * @param windowSecs Time window in seconds.
 * @returns Response if rate limited, null if allowed.
 */
export async function enforceRateLimit(
  identifier: string,
  category: string,
  maxRequests: number,
  windowSecs: number
): Promise<Response | null> {
  if (!upstashEnabled()) {
    console.warn("Upstash Redis not configured, bypassing rate limit.");
    return null; // Bypass if Redis env vars are omitted in this environment
  }

  const key = `ratelimit:${identifier}:${category}`;

  try {
    const incr = await upstashPost<number>(`/incr/${encodeURIComponent(key)}`);
    if (incr.error || typeof incr.result !== "number") {
      console.error("Upstash INCR failed:", incr.error ?? incr);
      return null; // Fail-open to avoid breaking product due to infra issues
    }

    const current = incr.result;
    
    // Set expiry on first increment
    if (current === 1) {
      const exp = await upstashPost<number>(`/expire/${encodeURIComponent(key)}/${windowSecs}`);
      if (exp.error) console.error("Upstash EXPIRE failed:", exp.error);
    }

    if (current > maxRequests) {
      console.warn(`[SECURITY] Rate limit exceeded by ${identifier} for ${category}`);
      return new Response(
        JSON.stringify({ 
          error: "Too many requests. Please try again later.",
          retryAfter: windowSecs
        }),
        {
          status: 429,
          headers: { 
            "Content-Type": "application/json",
            "Retry-After": windowSecs.toString()
          },
        }
      );
    }

    return null; 
  } catch (err) {
    console.error("Redis rate limiting error:", err);
    // Fail open or closed depending on preference? Typically, fail open to avoid downtime.
    return null;
  }
}
