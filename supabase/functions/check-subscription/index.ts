import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_TIERS: Record<string, { plan: string }> = {
  "prod_TyMbQ3mEvnVxKK": { plan: "pro" },
  "prod_TyMbNwl6IF6Jis": { plan: "business" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Not authenticated");

    // Get workspace ID and stripe_customer_id for this user
    const { data: memberData } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .single();

    // Try to get stripe_customer_id from workspace
    const { data: workspaceData } = memberData ? await supabase
      .from("workspaces")
      .select("stripe_customer_id")
      .eq("id", memberData.workspace_id)
      .maybeSingle() : { data: null };

    // ── DB-only path: when Stripe key is absent (local dev / test envs) ────────
    if (!stripeKey) {
      console.warn("[check-subscription] STRIPE_SECRET_KEY not set — using DB subscription only");
      if (memberData) {
        const { data: dbSub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("workspace_id", memberData.workspace_id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (dbSub && dbSub.plan !== "free") {
          return new Response(JSON.stringify({
            subscribed: true,
            plan: dbSub.plan,
            subscription_end: dbSub.current_period_end,
            cancel_at_period_end: dbSub.cancel_at_period_end ?? false,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Also check workspaces.plan as a final fallback
        const { data: ws } = await supabase
          .from("workspaces")
          .select("plan")
          .eq("id", memberData.workspace_id)
          .single();

        if (ws?.plan && ws.plan !== "free") {
          return new Response(JSON.stringify({
            subscribed: true,
            plan: ws.plan,
            subscription_end: null,
            cancel_at_period_end: false,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Full Stripe path ───────────────────────────────────────────────────────
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Prefer stripe_customer_id lookup (O(1)) over email scan (O(n))
    let stripeCustomer: any = null;
    if (workspaceData?.stripe_customer_id) {
      try {
        stripeCustomer = await stripe.customers.retrieve(workspaceData.stripe_customer_id);
      } catch {
        // Customer may have been deleted — fall back to email lookup
      }
    }
    const customers = stripeCustomer
      ? { data: [stripeCustomer] }
      : await stripe.customers.list({ email: userData.user.email, limit: 1 });

    if (customers.data.length === 0) {
      // Check for manually provisioned subscription (test accounts)
      if (memberData) {
        const { data: dbSub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("workspace_id", memberData.workspace_id)
          .eq("status", "active")
          .limit(1)
          .single();

        if (dbSub && dbSub.plan !== "free") {
          return new Response(JSON.stringify({
            subscribed: true,
            plan: dbSub.plan,
            subscription_end: dbSub.current_period_end,
            cancel_at_period_end: dbSub.cancel_at_period_end,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // Check DB fallback
      if (memberData) {
        const { data: dbSub } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("workspace_id", memberData.workspace_id)
          .eq("status", "active")
          .limit(1)
          .single();

        if (dbSub && dbSub.plan !== "free") {
          return new Response(JSON.stringify({
            subscribed: true,
            plan: dbSub.plan,
            subscription_end: dbSub.current_period_end,
            cancel_at_period_end: dbSub.cancel_at_period_end,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sub = subscriptions.data[0];
    const productId = sub.items.data[0]?.price?.product as string;
    const plan = PLAN_TIERS[productId]?.plan || "pro";
    const subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();

    // Sync to workspace

    if (memberData) {
      // Update workspace plan
      await supabase
        .from("workspaces")
        .update({ plan })
        .eq("id", memberData.workspace_id);

      // Upsert subscription record
      await supabase
        .from("subscriptions")
        .upsert({
          workspace_id: memberData.workspace_id,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          plan,
          status: sub.status,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end: subscriptionEnd,
          cancel_at_period_end: sub.cancel_at_period_end,
        }, { onConflict: "workspace_id" });
    }

    return new Response(JSON.stringify({
      subscribed: true,
      plan,
      product_id: productId,
      subscription_end: subscriptionEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[CHECK-SUBSCRIPTION] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
