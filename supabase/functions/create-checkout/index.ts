import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeErrorResponse } from "../_shared/errors.ts";
import { checkRateLimit } from "../_shared/rate_limit.ts";

// Restrict origin to the application domain — never allow wildcard on billing endpoints
const ALLOWED_ORIGIN = Deno.env.get("APP_URL") || "https://mushin.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Whitelist of valid Stripe Price IDs — any priceId not in this list is rejected
const VALID_PRICE_IDS = new Set([
  Deno.env.get("STRIPE_GROWTH_MONTHLY_PRICE_ID") || "",
  Deno.env.get("STRIPE_GROWTH_ANNUAL_PRICE_ID") || "",
  Deno.env.get("STRIPE_PRO_MONTHLY_PRICE_ID") || "",
  Deno.env.get("STRIPE_PRO_ANNUAL_PRICE_ID") || "",
  Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID") || "",
].filter(Boolean));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit: max 10 checkout attempts per hour per IP (prevents billing abuse)
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(clientIp, 'general', { perMin: 5, perHour: 10 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfter ?? 60) },
    });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Not authenticated");

    const { priceId } = await req.json().catch(() => ({}));
    if (!priceId || typeof priceId !== 'string') throw new Error("priceId is required");
    // Sanitise: priceId must look like a Stripe Price ID (price_*)
    if (!/^price_[a-zA-Z0-9]{10,}$/.test(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid price ID format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Security: reject any priceId not in the explicit whitelist
    if (VALID_PRICE_IDS.size > 0 && !VALID_PRICE_IDS.has(priceId)) {
      return new Response(JSON.stringify({ error: "Invalid price ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or reference existing customer
    const customers = await stripe.customers.list({ email: userData.user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const origin = req.headers.get("origin") || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userData.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
      metadata: {
        user_id: userData.user.id,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return safeErrorResponse(error, "[create-checkout]", corsHeaders);
  }
});
