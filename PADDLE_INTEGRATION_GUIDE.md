# Paddle Payment Gateway Integration Guide

## Current Status
- **Current Provider**: Stripe (fully implemented)
- **Requested Provider**: Paddle
- **Migration Complexity**: Medium (4-6 hours)

---

## Why Paddle vs Stripe?

### Paddle Advantages
- ✅ **Merchant of Record** - Paddle handles global tax compliance (VAT, GST, sales tax)
- ✅ **Built-in SaaS features** - Proration, trials, coupons out of the box
- ✅ **Global payments** - 100+ payment methods, 150+ countries
- ✅ **Automated tax collection** - No need for TaxJar/Avalara
- ✅ **Chargeback handling** - Paddle manages disputes

### Stripe Advantages
- ✅ More developer-friendly API
- ✅ Better documentation
- ✅ Lower fees for small volumes
- ✅ Already implemented in your codebase

---

## Step-by-Step Paddle Integration

### 1. Create Paddle Account
1. Go to [Paddle.com](https://paddle.com) and sign up
2. Complete business verification
3. Set up payout details (bank account)

### 2. Create Products & Prices in Paddle Dashboard

#### Product Setup
```
Product Name: MUSHIN Pro
Type: SaaS
Pricing: PKR 4,999/month (or $29/month)

Product Name: MUSHIN Business
Type: SaaS
Pricing: PKR 14,999/month (or $79/month)
```

#### Get Price IDs
After creating products, note down:
- `PADDLE_PRO_PRICE_ID=pri_...`
- `PADDLE_BUSINESS_PRICE_ID=pri_...`

### 3. Install Paddle.js (Frontend)

```bash
npm install @paddle/paddle-js
```

### 4. Update Environment Variables

Add to `.env`:
```env
# Paddle Configuration
VITE_PADDLE_CLIENT_TOKEN=client_...
PADDLE_API_KEY=secret_...
PADDLE_ENVIRONMENT=production  # or 'sandbox' for testing

# Price IDs
VITE_PADDLE_PRO_PRICE_ID=pri_...
VITE_PADDLE_BUSINESS_PRICE_ID=pri_...

# Webhook
PADDLE_WEBHOOK_SECRET=whsec_...

# Remove Stripe (or keep for migration period)
# VITE_STRIPE_PUBLISHABLE_KEY=...
# STRIPE_SECRET_KEY=...
```

### 5. Create Paddle Initialization Hook

Create `src/hooks/usePaddle.ts`:

```typescript
import { useEffect, useState } from 'react';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';

const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;

export function usePaddle() {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!PADDLE_CLIENT_TOKEN) {
      console.error('Paddle client token not configured');
      setIsLoading(false);
      return;
    }

    const initPaddle = async () => {
      const paddleInstance = await initializePaddle({
        token: PADDLE_CLIENT_TOKEN,
        environment: import.meta.env.VITE_PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
        eventCallback: (event) => {
          if (event.data && event.eventType) {
            console.log('Paddle event:', event.eventType, event.data);
            
            // Handle checkout completion
            if (event.eventType === 'checkout.completed') {
              // Redirect to success page
              window.location.href = `/billing?success=true&order_id=${event.data.order_id}`;
            }
          }
        },
      });

      if (paddleInstance) {
        setPaddle(paddleInstance);
      }
      setIsLoading(false);
    };

    initPaddle();
  }, []);

  return { paddle, isLoading };
}
```

### 6. Update Billing Page for Paddle

Update `src/pages/BillingPage.tsx`:

```typescript
import { usePaddle } from "@/hooks/usePaddle";

export default function BillingPage() {
  const { paddle, isLoading: paddleLoading } = usePaddle();
  // ... existing code

  const handleCheckout = async (priceId: string) => {
    if (!paddle) {
      toast({ 
        title: "Payment system loading", 
        description: "Please wait a moment and try again.",
        variant: "destructive"
      });
      return;
    }

    try {
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customer: {
          email: user?.email || undefined,
        },
        settings: {
          displayMode: 'overlay',
          theme: 'dark',
          allowLogout: false,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      toast({ title: "Checkout failed", description: message, variant: "destructive" });
    }
  };

  // ... rest of component
}
```

### 7. Create Paddle Webhook Edge Function

Create `supabase/functions/paddle-webhook/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paddle-signature",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify Paddle signature
    const signature = req.headers.get("paddle-signature");
    if (!signature) {
      throw new Error("Missing Paddle signature");
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
    
    // Verify signature (implement Paddle's signature verification)
    // See: https://developer.paddle.com/webhooks/verify-requests
    
    const eventData = JSON.parse(body);
    const eventType = eventData.event_type;

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Handle different webhook events
    switch (eventType) {
      case "subscription.created":
        await handleSubscriptionCreated(eventData, supabaseClient);
        break;
      case "subscription.updated":
        await handleSubscriptionUpdated(eventData, supabaseClient);
        break;
      case "subscription.cancelled":
        await handleSubscriptionCancelled(eventData, supabaseClient);
        break;
      case "payment.succeeded":
        await handlePaymentSucceeded(eventData, supabaseClient);
        break;
      case "payment.failed":
        await handlePaymentFailed(eventData, supabaseClient);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Paddle webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleSubscriptionCreated(eventData: any, supabase: any) {
  const { subscription_id, customer_id, items, status } = eventData.data;
  
  // Map Paddle plan to your plan keys
  const priceId = items[0].price_id;
  const plan = priceId === Deno.env.get("PADDLE_PRO_PRICE_ID") ? "pro" : "business";
  
  // Get workspace from customer metadata
  const { data: customer } = await supabase
    .from("subscriptions")
    .select("workspace_id")
    .eq("paddle_customer_id", customer_id)
    .single();
  
  if (!customer) {
    console.error("Workspace not found for customer:", customer_id);
    return;
  }
  
  // Update subscription
  await supabase.from("subscriptions").upsert({
    workspace_id: customer.workspace_id,
    plan,
    paddle_subscription_id: subscription_id,
    paddle_customer_id: customer_id,
    status: status === "active" ? "active" : "trialing",
    current_period_end: new Date(eventData.data.current_period_end).toISOString(),
  });
  
  // Reset workspace credits based on plan
  const credits = plan === "pro" ? { search: 500, enrichment: 100 } : { search: 2000, enrichment: 500 };
  await supabase.from("workspaces").update({
    search_credits_remaining: credits.search,
    enrichment_credits_remaining: credits.enrichment,
  }).eq("id", customer.workspace_id);
}

async function handleSubscriptionUpdated(eventData: any, supabase: any) {
  // Similar to created, but update existing subscription
  const { subscription_id, status } = eventData.data;
  
  await supabase
    .from("subscriptions")
    .update({
      status: status === "active" ? "active" : "paused",
      current_period_end: new Date(eventData.data.current_period_end).toISOString(),
    })
    .eq("paddle_subscription_id", subscription_id);
}

async function handleSubscriptionCancelled(eventData: any, supabase: any) {
  const { subscription_id } = eventData.data;
  
  await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      status: "canceling",
    })
    .eq("paddle_subscription_id", subscription_id);
}

async function handlePaymentSucceeded(eventData: any, supabase: any) {
  const { subscription_id, amount, currency, status } = eventData.data;
  
  // Get subscription
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("workspace_id")
    .eq("paddle_subscription_id", subscription_id)
    .single();
  
  if (!sub) return;
  
  // Record payment
  await supabase.from("payments").insert({
    workspace_id: sub.workspace_id,
    amount: Number(amount) / 100, // Convert from cents
    currency,
    status: "paid",
    paddle_payment_id: eventData.data.id,
    paid_at: new Date().toISOString(),
  });
}

async function handlePaymentFailed(eventData: any, supabase: any) {
  const { subscription_id } = eventData.data;
  
  // Notify user, mark subscription as past_due
  await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("paddle_subscription_id", subscription_id);
  
  // Could send email notification here
}
```

### 8. Update Subscription Hook

Update `src/hooks/useSubscription.ts`:

```typescript
// Replace Stripe-specific code with Paddle
export function useSubscription() {
  // ... existing state

  const checkout = async (priceId: string) => {
    // Use Paddle.js directly (handled in BillingPage)
    // This function can be removed or kept for compatibility
    throw new Error("Use Paddle.Checkout.open() directly");
  };

  const openPortal = () => {
    // Open Paddle Customer Portal
    if (window.Paddle) {
      window.Paddle.Customer.open();
    }
  };

  // ... rest of hook
}
```

### 9. Deploy Edge Function

```bash
# Deploy webhook handler
supabase functions deploy paddle-webhook

# Set webhook secret
supabase secrets set PADDLE_WEBHOOK_SECRET=whsec_...

# Get webhook URL from deployment output
# https://your-project.supabase.co/functions/v1/paddle-webhook
```

### 10. Configure Paddle Webhooks

In Paddle Dashboard:
1. Go to **Developer Tools** → **Webhooks**
2. Add endpoint: `https://your-project.supabase.co/functions/v1/paddle-webhook`
3. Subscribe to events:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.cancelled`
   - `payment.succeeded`
   - `payment.failed`
4. Copy webhook secret to `.env`

### 11. Update Database Schema

Add Paddle-specific fields to `subscriptions` table:

```sql
ALTER TABLE subscriptions
ADD COLUMN paddle_subscription_id TEXT,
ADD COLUMN paddle_customer_id TEXT,
ADD COLUMN cancel_at_period_end BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_paddle_sub ON subscriptions(paddle_subscription_id);
CREATE INDEX idx_paddle_cust ON subscriptions(paddle_customer_id);
```

### 12. Testing Checklist

- [ ] Paddle.js loads correctly
- [ ] Checkout overlay opens
- [ ] Test payment in sandbox mode
- [ ] Webhook events fire correctly
- [ ] Subscription created in database
- [ ] Credits reset on subscription
- [ ] Customer portal accessible
- [ ] Cancellation flow works
- [ ] Payment history updates

---

## Migration from Stripe to Paddle

### Phase 1: Parallel Operation (1-2 weeks)
1. Keep Stripe active for existing customers
2. Deploy Paddle for new customers
3. Test thoroughly in production

### Phase 2: Migration (2-4 weeks)
1. Export Stripe customer list
2. Import customers to Paddle (via API)
3. Email customers about migration
4. Provide incentive to switch (discount)

### Phase 3: Sunset Stripe (after 1 month)
1. Cancel all remaining Stripe subscriptions
2. Remove Stripe code from codebase
3. Close Stripe account (or keep for backup)

---

## Pricing Display Update

Update pricing section in `LandingPage.tsx`:

```typescript
// Change button text
<Link to="/auth" className="...">
  Subscribe Now
</Link>

// Update pricing description
<p className="text-[11px] text-zinc-500 mt-5">
  Secure payment via Paddle • All major cards accepted • VAT included
</p>
```

---

## Cost Comparison

| Fee Type | Stripe | Paddle |
|----------|--------|--------|
| Transaction Fee | 2.9% + $0.30 | 5% + $0.50 |
| Monthly Fee | $0 | $0 |
| Tax Handling | Extra (TaxJar ~$100/mo) | Included |
| Chargeback Fee | $15 | $0 (handled by Paddle) |
| International Cards | +1.5% | Included |

**Effective Rate**: Paddle is ~2% higher but includes tax compliance

---

## Security Notes

1. **Webhook Verification**: Always verify Paddle signatures
2. **Client Token**: Never expose API key in frontend (use client token only)
3. **Environment**: Use sandbox for testing, production for live
4. **PCI Compliance**: Paddle handles all PCI requirements (you're exempt)

---

## Support Resources

- **Paddle Docs**: https://developer.paddle.com/
- **API Reference**: https://developer.paddle.com/api-reference/
- **Webhook Events**: https://developer.paddle.com/webhooks/event-types
- **Support Email**: support@paddle.com

---

## Estimated Timeline

| Task | Time |
|------|------|
| Account setup & product creation | 1 hour |
| Frontend integration (Paddle.js) | 2 hours |
| Backend webhook handler | 2 hours |
| Testing & debugging | 2 hours |
| Documentation & deployment | 1 hour |
| **Total** | **8 hours** |

---

## Next Steps

1. ✅ Create Paddle account
2. ✅ Set up products and prices
3. ✅ Install `@paddle/paddle-js`
4. ✅ Add environment variables
5. ✅ Create `usePaddle` hook
6. ✅ Update `BillingPage.tsx`
7. ✅ Deploy webhook edge function
8. ✅ Configure webhooks in Paddle
9. ✅ Test in sandbox mode
10. ✅ Switch to production

**Need help?** Let me know and I can implement the full Paddle integration for you.
