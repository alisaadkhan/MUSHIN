import { performPrivilegedWrite } from "../_shared/privileged_gateway.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
// email-webhook receives server-to-server calls from Resend. CORS headers are
// not meaningful for S2S webhooks but must be present for Supabase edge runtime.
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "https://mushin.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Verify a Resend/Svix webhook signature.
 * Svix signs: "{svix-id}.{svix-timestamp}.{raw-body}" with HMAC-SHA256.
 * The `svix-signature` header contains one or more base64 signatures prefixed with "v1,".
 */
async function verifyWebhookSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): Promise<boolean> {
  const msgId = headers.get("svix-id");
  const msgTimestamp = headers.get("svix-timestamp");
  const msgSignature = headers.get("svix-signature");

  if (!msgId || !msgTimestamp || !msgSignature) return false;

  // Reject timestamps older than 5 minutes (replay protection)
  const ts = parseInt(msgTimestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  // Strip the base64 prefix used by Svix secrets (whsec_...)
  const secretBytes = secret.startsWith("whsec_")
    ? Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(secret);

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const toSign = new TextEncoder().encode(`${msgId}.${msgTimestamp}.${rawBody}`);
  const computed = await crypto.subtle.sign("HMAC", key, toSign);
  const computedB64 = btoa(String.fromCharCode(...new Uint8Array(computed)));

  // svix-signature may carry multiple space-separated "v1,<sig>" tokens
  const providedSigs = msgSignature.split(" ").map((s) => s.replace(/^v1,/, ""));
  return providedSigs.some((sig) => sig === computedB64);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET not configured — rejecting webhook");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    const valid = await verifyWebhookSignature(rawBody, req.headers, webhookSecret);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = await performPrivilegedWrite({
        authHeader: req.headers.get("Authorization"),
        action: "gateway:privileged-client-bootstrap",
        execute: async (_ctx, client) => client,
    });

    const payload = JSON.parse(rawBody);
    const eventType = payload?.type;
    const emailTo = payload?.data?.to?.[0] || payload?.data?.email;

    if (!eventType || !emailTo) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the most recent outreach_log entry matching this email
    const { data: logEntry } = await adminClient
      .from("outreach_log")
      .select("id")
      .eq("email_to", emailTo)
      .order("contacted_at", { ascending: false })
      .limit(1)
      .single();

    if (!logEntry) {
      console.log("No outreach_log entry found for:", emailTo);
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();

    if (eventType === "email.opened") {
      await adminClient
        .from("outreach_log")
        .update({ opened_at: now })
        .eq("id", logEntry.id)
        .is("opened_at", null);
    } else if (eventType === "email.clicked") {
      await adminClient
        .from("outreach_log")
        .update({ clicked_at: now })
        .eq("id", logEntry.id)
        .is("clicked_at", null);
    }

    return new Response(JSON.stringify({ ok: true, matched: true, event: eventType }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("email-webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
