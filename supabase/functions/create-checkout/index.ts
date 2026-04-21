/**
 * create-checkout — Paddle Billing Edge Function
 *
 * Creates a Paddle checkout session for a given price ID.
 * NEVER trusts the frontend for payment state.
 * All secret keys read from Deno.env (Supabase secrets), never from client.
 *
 * Required secrets (set via `supabase secrets set`):
 *   PADDLE_API_KEY          — Paddle API secret key
 *   PADDLE_ENVIRONMENT      — "sandbox" or "production"  (default: production)
 *   APP_URL                 — Your app's production URL
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, tooManyRequests } from "../_shared/rate_limit.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

const APP_URL = Deno.env.get("APP_URL") || "https://mushin.app";
const ALLOWED_ORIGINS = new Set([
  APP_URL,
  "http://localhost:5173",
  "http://localhost:3000",
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Valid Paddle price IDs — loaded from env so they NEVER come from the client
const VALID_PRICE_IDS = new Set([
  Deno.env.get("PADDLE_PRO_MONTHLY_PRICE_ID")     ?? "",
  Deno.env.get("PADDLE_PRO_ANNUAL_PRICE_ID")       ?? "",
  Deno.env.get("PADDLE_BUSINESS_MONTHLY_PRICE_ID") ?? "",
  Deno.env.get("PADDLE_BUSINESS_ANNUAL_PRICE_ID")  ?? "",
  Deno.env.get("PADDLE_ENTERPRISE_MONTHLY_PRICE_ID") ?? "",
  Deno.env.get("PADDLE_ENTERPRISE_ANNUAL_PRICE_ID")  ?? "",
].filter(Boolean));

// ── Paddle API helper ─────────────────────────────────────────────────────────
const PADDLE_ENV   = Deno.env.get("PADDLE_ENVIRONMENT") ?? "production";
const PADDLE_BASE  = PADDLE_ENV === "sandbox"
  ? "https://sandbox-api.paddle.com"
  : "https://api.paddle.com";

async function paddlePost(
  path: string,
  body: Record<string, unknown>,
  apiKey: string
): Promise<{ ok: boolean; data: any; error?: string }> {
  const res = await fetch(`${PADDLE_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) {
    return { ok: false, data: null, error: json?.error?.detail ?? `Paddle error ${res.status}` };
  }
  return { ok: true, data: json?.data ?? json };
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const hdrs = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: hdrs });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...hdrs, "Content-Type": "application/json" },
    });
  }

  // Rate limit: 5/min, 10/hour per IP — billing abuse prevention
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(clientIp, "general", { perMin: 5, perHour: 10 });
  if (!rl.allowed) {
    return tooManyRequests(rl.retryAfter ?? 60, hdrs);
  }

  try {
    const PADDLE_API_KEY = Deno.env.get("PADDLE_API_KEY");
    if (!PADDLE_API_KEY) {
      console.error("[create-checkout] PADDLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Payment service temporarily unavailable" }), {
        status: 503, headers: { ...hdrs, "Content-Type": "application/json" },
      });
    }

    // ── Auth: verify caller is a real authenticated user ───────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...hdrs, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...hdrs, "Content-Type": "application/json" },
      });
    }

    // ── Parse and validate request body ───────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { priceId } = body as { priceId?: string };

    if (!priceId || typeof priceId !== "string") {
      return new Response(JSON.stringify({ error: "priceId is required" }), {
        status: 400, headers: { ...hdrs, "Content-Type": "application/json" },
      });
    }

    // Validate against server-side allowlist — never trust an arbitrary priceId from client
    if (VALID_PRICE_IDS.size > 0 && !VALID_PRICE_IDS.has(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid price ID" }), {
        status: 400, headers: { ...hdrs, "Content-Type": "application/json" },
      });
    }

    // Validate redirect origin
    const rawOrigin = req.headers.get("origin") ?? "";
    const safeOrigin = ALLOWED_ORIGINS.has(rawOrigin) ? rawOrigin : APP_URL;

    // ── Create Paddle checkout transaction ────────────────────────────────
    // Paddle API v1: POST /transactions with checkout type
    // The response includes a checkout URL the client redirects to.
    const { ok, data, error: paddleError } = await paddlePost(
      "/transactions",
      {
        items: [{ price_id: priceId, quantity: 1 }],
        customer: { email: user.email },
        checkout: {
          url: `${safeOrigin}/billing?paddle_checkout=true`,
        },
        custom_data: {
          user_id: user.id,          // Attached to webhook events
          supabase_url: Deno.env.get("SUPABASE_URL"),
        },
        success_url: `${safeOrigin}/billing?success=true`,
        cancel_url:  `${safeOrigin}/billing?canceled=true`,
      },
      PADDLE_API_KEY
    );

    if (!ok) {
      console.error("[create-checkout] Paddle error:", paddleError);
      return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
        status: 502, headers: { ...hdrs, "Content-Type": "application/json" },
      });
    }

    // Return the checkout URL — client redirects the user there
    const checkoutUrl = data?.checkout?.url ?? data?.url;
    return new Response(JSON.stringify({ url: checkoutUrl, transaction_id: data?.id }), {
      headers: { ...hdrs, "Content-Type": "application/json" },
    });

  } catch (err) {
    return safeErrorResponse(err, "[create-checkout]", hdrs);
  }
});
