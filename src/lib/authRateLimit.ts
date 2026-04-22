/**
 * Client-side password-auth rate limiter.
 *
 * Strategy:
 *  1. Call the edge function to consume one slot.
 *  2. If the edge function explicitly returns 429 → block (too many attempts).
 *  3. If the edge function is unreachable, misconfigured, or returns ANY other
 *     error (4xx/5xx) → FAIL OPEN and allow the attempt through.
 *     Supabase Auth already has its own server-side rate limiting as a safety net.
 *
 * This prevents a broken or undeployed edge function from locking users out.
 */
import { invokeEdgePublic } from "@/lib/edge";

export async function consumePasswordAuthSlot(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  try {
    const { data, error } = await invokeEdgePublic<{
      ok?: boolean;
      error?: string;
      retry_after?: number;
      code?: string;
    }>("auth-password-rate", {});

    // Network/infra error — fail open so users are never locked out by
    // a broken edge function.
    if (error) {
      // Only block on explicit 429 (rate limited); pass everything else.
      if (error.status === 429) {
        const msg =
          typeof (error.body as any)?.error === "string"
            ? (error.body as any).error
            : "Too many sign-in attempts. Please wait a moment and try again.";
        return { ok: false, message: msg };
      }
      // Any other error (500, 503, network timeout, etc.) → allow through.
      console.warn("[authRateLimit] edge function error, failing open:", error.message);
      return { ok: true };
    }

    // Edge function returned a structured payload with an error field.
    if (data && typeof data === "object" && "error" in data && data.error) {
      // Only honour "rate_limited" code — everything else is infra noise.
      if ((data as any).code === "rate_limited") {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Too many sign-in attempts. Please wait a moment and try again.";
        return { ok: false, message: msg };
      }
      // Any other error code (e.g. rpc missing) → fail open.
      console.warn("[authRateLimit] non-blocking error from edge fn, failing open:", data.error);
      return { ok: true };
    }

    // Happy path — slot consumed successfully.
    if (data?.ok) {
      return { ok: true };
    }

    // Unknown response shape — fail open.
    return { ok: true };
  } catch (err) {
    // Totally unexpected JS exception → fail open.
    console.warn("[authRateLimit] unexpected exception, failing open:", err);
    return { ok: true };
  }
}
