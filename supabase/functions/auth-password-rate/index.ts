/**
 * Public (anon) endpoint: consume one password-auth attempt slot per client IP.
 * Enforces max 5 attempts per 15 minutes (login, signup password, staff login).
 * Call immediately before supabase.auth.signInWithPassword / signUp.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

function getIpAddress(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? null;
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.error("[auth-password-rate] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return jsonResponse(req, { error: "Service misconfigured" }, 503);
  }

  const ip = getIpAddress(req) ?? "unknown";
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await client.rpc("password_login_rate_consume", { p_ip: ip });

  if (error) {
    const msg = String(error.message ?? "");
    const code = String((error as { code?: string }).code ?? "");
    // PostgREST / Postgres: function not in schema cache or not deployed yet
    const rpcMissing =
      code === "42883" ||
      code === "PGRST202" ||
      /schema cache|could not find|does not exist|function public\.password_login_rate_consume/i.test(msg);
    const failOpenEnv = Deno.env.get("AUTH_PASSWORD_RATE_FAIL_OPEN") === "true";

    console.error("[auth-password-rate] rpc error:", code, msg);

    if (rpcMissing || failOpenEnv) {
      console.warn(
        "[auth-password-rate] DEGRADED: allowing password auth without rate count — apply migration " +
          "20260421200000_password_login_rate_gate.sql (or set AUTH_PASSWORD_RATE_FAIL_OPEN=false once RPC works).",
      );
      return jsonResponse(req, { ok: true, remaining: 999, degraded: true });
    }

    return jsonResponse(
      req,
      {
        error: "Could not verify rate limit",
        code: "rate_limit_rpc_error",
      },
      503,
    );
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  const allowed = Boolean(payload.allowed);
  const retryAfter = Number(payload.retry_after ?? 0);

  if (!allowed) {
    return jsonResponse(
      req,
      {
        error: "Too many sign-in attempts. Try again later.",
        code: "rate_limited",
        retry_after: retryAfter,
      },
      429,
    );
  }

  return jsonResponse(req, { ok: true, remaining: payload.remaining });
});
