import { useEffect, useState } from "react";
import { SEO } from "@/components/SEO";
import { Link, useSearchParams } from "react-router-dom";
import { Check, CreditCard, ExternalLink, Zap } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { PLANS, PlanKey } from "@/lib/plans";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { PaymentsPanel, type PaymentRecord } from "@/components/payments/PaymentsPanel";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

const planOrder: PlanKey[] = ["free", "pro", "business"];

const features = [
  { key: "search_credits", label: "Search credits / mo" },
  { key: "enrichment_credits", label: "Enrichment credits / mo" },
  { key: "campaigns", label: "Campaigns" },
  { key: "email_sends", label: "Email sends / mo" },
  { key: "ai_credits", label: "AI insights / mo" },
  { key: "team_members", label: "Team members" },
  { key: "priority_support", label: "Priority support" },
] as const;

export default function BillingPage() {
  const { plan, subscribed, subscriptionEnd, cancelAtPeriodEnd, checkout, openPortal, refresh, isLoading } = useSubscription();
  const { data: credits } = useWorkspaceCredits();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    // Fetch payments for the workspace
    const fetchPayments = async () => {
      const { data: ws } = await (supabase as any).rpc("get_user_workspace_id");
      if (!ws) return;

      const { data, error } = await (supabase as any)
        .from("payments")
        .select(`
          id, amount, currency, status, due_date,
          campaigns(name), influencer_profiles(full_name, username)
        `)
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.code === "42P01") return; // table doesn't exist
        console.warn("Failed to fetch payments:", error);
        return;
      }

      if (data) {
        const mapped = data.map(d => ({
          id: d.id,
          amount: d.amount,
          currency: d.currency,
          status: d.status as any,
          due_date: d.due_date,
          campaign_name: d.campaigns?.name || "Unknown",
          influencer_name: d.influencer_profiles?.full_name || d.influencer_profiles?.username || "Unknown"
        }));
        setPayments(mapped);
      }
    };
    fetchPayments();
  }, []);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({ title: "Subscription activated!", description: "Your plan is now active." });
      refresh();
    }
    if (searchParams.get("canceled") === "true") {
      toast({ title: "Checkout canceled", description: "No changes were made." });
    }
  }, [searchParams, toast, refresh]);

  const handleCheckout = async (priceId: string) => {
    try {
      // Determine plan from priceId
      const planForPrice = Object.values(PLANS).find(p => 'price_id' in p && p.price_id === priceId)?.name || 'unknown';
      trackEvent("checkout_started", { plan: planForPrice, priceId });
      await checkout(priceId);
      trackEvent("checkout_completed", { plan: planForPrice, priceId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      trackEvent("checkout_failed", { error: message });
      toast({ title: "Checkout failed", description: message, variant: "destructive" });
    }
  };

  const handlePortal = async () => {
    try {
      await openPortal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Portal error", description: message, variant: "destructive" });
    }
  };

  const currentPlanConfig = PLANS[plan] || PLANS.free;

  const formatValue = (key: string, value: any) => {
    if (key === "priority_support") return value ? "✓" : "—";
    if (value === Infinity) return "Unlimited";
    return String(value);
  };

  const searchMax = currentPlanConfig.search_credits;
  const enrichMax = currentPlanConfig.enrichment_credits;
  const emailMax = currentPlanConfig.email_sends;
  const aiMax = currentPlanConfig.ai_credits;

  const usageItems = [
    { label: "Search Credits", used: searchMax - (credits?.search_credits_remaining ?? searchMax), max: searchMax },
    { label: "Enrichment Credits", used: enrichMax - (credits?.enrichment_credits_remaining ?? enrichMax), max: enrichMax },
    { label: "Email Sends", used: emailMax - (credits?.email_sends_remaining ?? emailMax), max: emailMax },
    { label: "AI Insights", used: aiMax === Infinity ? 0 : aiMax - (credits?.ai_credits_remaining ?? aiMax), max: aiMax },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <SEO title="Billing" description="Manage your MUSHIN subscription and billing." noindex />
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your subscription and billing</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Current Plan & Usage */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Current Plan</p>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-foreground capitalize">{currentPlanConfig.name}</h2>
                  {cancelAtPeriodEnd && (
                    <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5 rounded-md text-[10px]">Cancels at period end</Badge>
                  )}
                </div>
                {subscriptionEnd && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {cancelAtPeriodEnd ? "Access until" : "Renews"} {format(new Date(subscriptionEnd), "MMM d, yyyy")}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:items-end">
                <span className="text-3xl font-bold text-foreground">${currentPlanConfig.price}<span className="text-base font-normal text-muted-foreground">/mo</span></span>
                {subscribed && (
                  <Button variant="link" size="sm" onClick={handlePortal} className="h-auto p-0 text-primary mt-1 text-xs">
                    Manage Subscription <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-border/50">
              <div className="flex items-center gap-2 mb-5">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Current Usage</h3>
              </div>

              <div className="space-y-4">
                {usageItems.map((u) => {
                  const pct = u.max === Infinity ? 0 : (u.used / u.max) * 100;
                  return (
                    <div key={u.label}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-muted-foreground">{u.label}</span>
                        <span className="text-foreground font-medium text-xs">
                          {u.max === Infinity ? "Unlimited" : `${u.used.toLocaleString()} / ${u.max.toLocaleString()}`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${pct > 90 ? "bg-destructive" : pct > 75 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Payouts and Invoices (Phase 6) */}
          <PaymentsPanel payments={payments} className="bg-background/80 backdrop-blur-md shadow-sm border-white/50" />

          {/* Billing history */}
          {subscribed && (
            <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Billing History</h3>
              <p className="text-xs text-muted-foreground mb-4">View and download your past invoices from the Stripe customer portal.</p>
              <Button variant="outline" size="sm" onClick={handlePortal} className="gap-2">
                <ExternalLink size={14} />
                Open Billing Portal
              </Button>
            </div>
          )}
        </div>

        {/* Right Column: Payment & Plans */}
        <div className="space-y-6">
          {/* Payment Method */}
          <div className="bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Payment Method</h3>
              {subscribed && (
                <Button variant="outline" size="sm" onClick={handlePortal} className="h-7 text-[11px] rounded-md px-2">
                  Update
                </Button>
              )}
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-6 rounded bg-muted flex items-center justify-center border border-border/50 flex-shrink-0 mt-0.5">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {subscribed ? "Payment method on file" : "No payment method"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {subscribed && subscriptionEnd
                    ? `${cancelAtPeriodEnd ? "Access until" : "Renews"} ${new Date(subscriptionEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : subscribed
                    ? "Active subscription"
                    : "Add a card to upgrade your plan."}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground px-1">Available Plans</h3>

            {planOrder.map((key, i) => {
              const p = PLANS[key];
              const isCurrent = plan === key;
              const isUpgrade = planOrder.indexOf(key) > planOrder.indexOf(plan);

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className={`bg-background/80 backdrop-blur-md border shadow-sm rounded-2xl p-5 transition-all duration-300 relative overflow-hidden ${isCurrent ? "border-primary/50 ring-1 ring-primary/20" : "border-white/50 hover:shadow-md"}`}>
                    {isCurrent && (
                      <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-[10px] uppercase font-bold tracking-wider rounded-bl-lg">
                        Current
                      </div>
                    )}

                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-foreground mb-1 capitalize">{p.name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground">${p.price}</span>
                        {p.price > 0 && <span className="text-sm text-muted-foreground font-medium">/mo</span>}
                      </div>
                    </div>

                    <div className="space-y-2 mb-5">
                      {features.map((f) => {
                        const val = (p as any)[f.key];
                        // Only show non-zero/non-false features to save space in sidebar
                        if (!val) return null;

                        return (
                          <div key={f.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[13px] py-1 border-b border-border/30 last:border-0 last:pb-0">
                            <span className="text-muted-foreground flex items-center gap-1.5"><Check className="h-3 w-3 text-primary/70" /> {f.label}</span>
                            <span className="font-medium text-foreground sm:text-right">
                              {formatValue(f.key, val)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {isUpgrade && "price_id" in p && (
                      <Button
                        className="w-full btn-shine rounded-lg"
                        onClick={() => handleCheckout((p as any).price_id)}
                      >
                        Upgrade to {p.name}
                      </Button>
                    )}
                    {isCurrent && plan !== "free" && (
                      <Button variant="outline" className="w-full rounded-lg" onClick={handlePortal}>
                        Manage Plan
                      </Button>
                    )}
                    {isCurrent && plan === "free" && (
                      <Button variant="outline" className="w-full rounded-lg bg-muted/30" disabled>
                        Selected Space
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
