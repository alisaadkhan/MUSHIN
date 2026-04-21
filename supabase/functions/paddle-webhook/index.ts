/**
 * paddle-webhook — Paddle Webhook Edge Function
 *
 * Receives signed webhook events from Paddle and syncs subscription
 * state into the paddle_subscriptions table.
 *
 * Security:
 * - Validates Paddle-Signature header before processing any event
 * - Uses paddle_webhooks_log for idempotency (no double-processing)
 * - All DB writes use the service-role client (never anon)
 *
 * Required secrets (set via `supabase secrets set`):
 *   PADDLE_WEBHOOK_SECRET  — from Paddle Dashboard > Notifications
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_URL
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── HMAC-SHA256 signature verification ──────────────────────────────────────
async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) return false;

  // Paddle sends: h1=<hex_signature>
  // Multiple signatures may be present separated by semicolons — verify any one
  const parts = signatureHeader.split(";").map((s) => s.trim());
  const h1Part = parts.find((p) => p.startsWith("h1="));
  if (!h1Part) return false;

  const receivedHex = h1Part.replace("h1=", "");

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const computedHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare
  if (computedHex.length !== receivedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ receivedHex.charCodeAt(i);
  }
  return diff === 0;
}

// ── Map Paddle plan product ID → plan name ────────────────────────────────────
function resolvePlanName(productId: string | undefined): string {
  if (!productId) return "free";
  const map: Record<string, string> = {
    [Deno.env.get("PADDLE_PRO_PRODUCT_ID")     ?? "__pro"]:      "pro",
    [Deno.env.get("PADDLE_BUSINESS_PRODUCT_ID") ?? "__business"]: "business",
    [Deno.env.get("PADDLE_ENTERPRISE_PRODUCT_ID") ?? "__enterprise"]: "enterprise",
  };
  return map[productId] ?? "pro";
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Paddle webhooks are always POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // ── 1. Verify signature ───────────────────────────────────────────────────
  const WEBHOOK_SECRET = Deno.env.get("PADDLE_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) {
    console.error("[paddle-webhook] PADDLE_WEBHOOK_SECRET not configured — rejecting all events");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signatureHeader = req.headers.get("Paddle-Signature");
  const isValid = await verifyPaddleSignature(rawBody, signatureHeader, WEBHOOK_SECRET);
  if (!isValid) {
    console.warn("[paddle-webhook] Invalid signature — rejecting event");
    return new Response("Invalid signature", { status: 401 });
  }

  // ── 2. Parse event ────────────────────────────────────────────────────────
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventId   = event?.notification_id ?? event?.id ?? `unknown-${Date.now()}`;
  const eventType = event?.event_type ?? event?.alert_name ?? "unknown";
  const payload   = event?.data ?? event ?? {};

  console.log(`[paddle-webhook] Received: ${eventType} (id: ${eventId})`);

  // ── 3. Create service-role Supabase client ────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── 4. Idempotency check ──────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("paddle_webhooks_log")
    .select("id")
    .eq("paddle_event_id", eventId)
    .single();

  if (existing) {
    console.log(`[paddle-webhook] Already processed event ${eventId} — skipping`);
    return new Response("OK (already processed)", { status: 200 });
  }

  // ── 5. Process event ──────────────────────────────────────────────────────
  let processingError: string | null = null;

  try {
    await handleEvent(supabase, eventType, payload);
  } catch (err: unknown) {
    processingError = err instanceof Error ? err.message : String(err);
    console.error(`[paddle-webhook] Error processing ${eventType}:`, processingError);
  }

  // ── 6. Log to idempotency table (always, even on error) ──────────────────
  await supabase.from("paddle_webhooks_log").insert({
    paddle_event_id:  eventId,
    event_type:       eventType,
    payload:          payload,
    processing_error: processingError,
  }).catch((e: any) => console.error("[paddle-webhook] Failed to write log:", e.message));

  // Return 200 even on processing errors — prevents Paddle from retrying storm
  // Alerts will fire separately from monitoring
  return new Response("OK", { status: 200 });
});

// ── Event handlers ────────────────────────────────────────────────────────────
async function handleEvent(supabase: any, eventType: string, data: any): Promise<void> {
  switch (eventType) {
    case "subscription.created":
    case "subscription.activated":
      await upsertSubscription(supabase, data, "active");
      break;

    case "subscription.updated":
      // Determine effective status from Paddle's status field
      await upsertSubscription(supabase, data, data.status ?? "active");
      break;

    case "subscription.canceled":
      await upsertSubscription(supabase, data, "canceled");
      break;

    case "subscription.paused":
      await upsertSubscription(supabase, data, "paused");
      break;

    case "subscription.resumed":
      await upsertSubscription(supabase, data, "active");
      break;

    case "transaction.completed":
      // Transaction completed but subscription may not be created yet — update if exists
      await handleTransactionCompleted(supabase, data);
      break;

    case "transaction.payment_failed":
      await handlePaymentFailed(supabase, data);
      break;

    default:
      console.log(`[paddle-webhook] Unhandled event type: ${eventType}`);
  }
}

// ── Helper: resolve Supabase user_id from custom_data.user_id ─────────────────
async function resolveUserId(supabase: any, data: any): Promise<string | null> {
  // Paddle lets us attach custom_data to transactions/subscriptions
  const customUserId = data?.custom_data?.user_id;
  if (customUserId) return customUserId;

  // Fallback: look up by Paddle customer email
  const email = data?.customer?.email ?? data?.email;
  if (!email) return null;

  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error || !users) return null;

  const match = users.find((u: any) => u.email === email);
  return match?.id ?? null;
}

async function upsertSubscription(supabase: any, data: any, status: string): Promise<void> {
  const userId = await resolveUserId(supabase, data);
  if (!userId) {
    console.error("[paddle-webhook] Could not resolve user_id for subscription", data?.id);
    return;
  }

  const planName = resolvePlanName(data?.items?.[0]?.price?.product_id ?? data?.product_id);

  // Parse billing period dates
  const currentBilling = data?.current_billing_period ?? data?.billing_period ?? {};
  const periodStart = currentBilling?.starts_at ?? null;
  const periodEnd   = currentBilling?.ends_at   ?? null;

  const record = {
    user_id:                userId,
    paddle_subscription_id: data.id,
    paddle_customer_id:     data.customer_id ?? data.customer?.id ?? "",
    paddle_product_id:      data?.items?.[0]?.price?.product_id ?? null,
    paddle_price_id:        data?.items?.[0]?.price?.id ?? null,
    plan_name:              planName,
    status,
    current_period_start:   periodStart,
    current_period_end:     periodEnd,
    cancel_at_period_end:   data?.scheduled_change?.action === "cancel" ?? false,
    canceled_at:            status === "canceled" ? new Date().toISOString() : null,
    raw_paddle_data:        data,
    updated_at:             new Date().toISOString(),
  };

  const { error } = await supabase
    .from("paddle_subscriptions")
    .upsert(record, { onConflict: "paddle_subscription_id" });

  if (error) throw new Error(`Failed to upsert subscription: ${error.message}`);

  // Sync usage limits to reflect new plan
  await supabase.rpc("sync_usage_limits_from_subscription", {
    p_user_id: userId,
    p_plan_name: planName,
  }).catch((e: any) => console.warn("[paddle-webhook] sync_usage_limits failed:", e.message));

  console.log(`[paddle-webhook] Upserted subscription for user ${userId}: plan=${planName}, status=${status}`);
}

async function handleTransactionCompleted(supabase: any, data: any): Promise<void> {
  // A completed transaction (one-off or subscription payment) — update subscription status if active
  const subscriptionId = data?.subscription_id;
  if (!subscriptionId) return;

  const { error } = await supabase
    .from("paddle_subscriptions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", subscriptionId);

  if (error) console.warn("[paddle-webhook] Could not update transaction status:", error.message);
}

async function handlePaymentFailed(supabase: any, data: any): Promise<void> {
  const subscriptionId = data?.subscription_id;
  if (!subscriptionId) return;

  const { error } = await supabase
    .from("paddle_subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", subscriptionId);

  if (error) console.warn("[paddle-webhook] Could not update past_due status:", error.message);
}
