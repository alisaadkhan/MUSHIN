import { useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Crown, Zap, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { PLANS, PlanKey } from "@/lib/plans";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";

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
      await checkout(priceId);
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    }
  };

  const handlePortal = async () => {
    try {
      await openPortal();
    } catch (err: any) {
      toast({ title: "Portal error", description: err.message, variant: "destructive" });
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

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and usage</p>
      </div>

      {/* Current Plan Info */}
      {subscribed && (
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">
                    {currentPlanConfig.name} Plan
                    {cancelAtPeriodEnd && (
                      <Badge variant="outline" className="ml-2 text-destructive border-destructive/30">Cancels at period end</Badge>
                    )}
                  </p>
                  {subscriptionEnd && (
                    <p className="text-xs text-muted-foreground">
                      {cancelAtPeriodEnd ? "Access until" : "Renews"} {format(new Date(subscriptionEnd), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handlePortal} className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                Manage Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credit Usage */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Current Usage</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Searches", used: searchMax - (credits?.search_credits_remaining ?? searchMax), max: searchMax },
              { label: "Enrichments", used: enrichMax - (credits?.enrichment_credits_remaining ?? enrichMax), max: enrichMax },
              { label: "Emails", used: emailMax - (credits?.email_sends_remaining ?? emailMax), max: emailMax },
              { label: "AI Insights", used: aiMax === Infinity ? 0 : aiMax - (credits?.ai_credits_remaining ?? aiMax), max: aiMax },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="data-mono text-xs">
                    {item.max === Infinity ? "∞" : `${item.used} / ${item.max}`}
                  </span>
                </div>
                <Progress value={item.max === Infinity ? 0 : (item.used / item.max) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {planOrder.map((key, i) => {
          const p = PLANS[key];
          const isCurrent = plan === key;
          const isUpgrade = planOrder.indexOf(key) > planOrder.indexOf(plan);

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`glass-card relative overflow-hidden ${isCurrent ? "border-primary/50 ring-1 ring-primary/20" : ""}`}>
                {isCurrent && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-bl-lg">
                    Current
                  </div>
                )}
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-bold data-mono">${p.price}</span>
                      {p.price > 0 && <span className="text-muted-foreground text-sm">/mo</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {features.map((f) => (
                      <div key={f.key} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-muted-foreground">{f.label}:</span>
                        <span className="font-medium data-mono ml-auto">
                          {formatValue(f.key, (p as any)[f.key])}
                        </span>
                      </div>
                    ))}
                  </div>

                  {isUpgrade && "price_id" in p && (
                    <Button
                      className="w-full btn-shine gap-1.5"
                      onClick={() => handleCheckout((p as any).price_id)}
                    >
                      <CreditCard className="h-4 w-4" />
                      Upgrade to {p.name}
                    </Button>
                  )}
                  {isCurrent && plan !== "free" && (
                    <Button variant="outline" className="w-full" onClick={handlePortal}>
                      Manage Plan
                    </Button>
                  )}
                  {isCurrent && plan === "free" && (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
