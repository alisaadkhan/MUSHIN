import { Redis } from "https://deno.land/x/upstash_redis@v1.20.0/mod.ts";

let redis: Redis | null = null;

try {
  const url = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const token = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  if (url && token) {
    redis = new Redis({ url, token });
  }
} catch (e) {
  console.error("Failed to initialize Redis", e);
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
  if (!redis) {
    console.warn("Redis not configured, bypassing rate limit.");
    return null; // Bypass if Redis env vars are omitted in this environment
  }

  const key = `ratelimit:${identifier}:${category}`;

  try {
    const current = await redis.incr(key);
    
    // Set expiry on first increment
    if (current === 1) {
      await redis.expire(key, windowSecs);
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
