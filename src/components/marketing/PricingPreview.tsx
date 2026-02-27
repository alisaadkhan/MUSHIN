import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.12 } } };

const PKR_PLANS = [
  {
    key: "free",
    name: "Free",
    monthly: 0,
    annual: 0,
    currency: "₨",
    highlighted: false,
    badge: null,
    features: [
      "50 creator searches / month",
      "Basic authenticity scoring",
      "3 campaign boards",
      "Instagram, TikTok & YouTube",
      "Email support",
    ],
    cta: "Start Free",
  },
  {
    key: "pro",
    name: "Pro",
    monthly: 4999,
    annual: 3999,
    currency: "₨",
    highlighted: true,
    badge: "Most Popular",
    features: [
      "500 creator searches / month",
      "Full AI fraud & IQ scoring",
      "Unlimited campaign boards",
      "City & niche filters",
      "WhatsApp outreach integration",
      "PKR budget tracking",
      "Priority support",
    ],
    cta: "Start Pro Trial",
  },
  {
    key: "business",
    name: "Business",
    monthly: 12999,
    annual: 10399,
    currency: "₨",
    highlighted: false,
    badge: "Agency / Team",
    features: [
      "Unlimited creator searches",
      "Advanced audience demographics",
      "Multi-city campaign analytics",
      "CSV export & list sharing",
      "Dedicated account manager",
      "Custom integrations",
      "Onboarding & 1:1 support",
    ],
    cta: "Contact Sales",
  },
];

interface Props { ctaPath: string; }

export function PricingPreview({ ctaPath }: Props) {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto text-center space-y-16"
      >
        <div className="space-y-4">
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-widest text-primary">Pricing</motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            Simple Pricing in <span className="aurora-text">Pakistani Rupees</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground max-w-lg mx-auto text-sm">
            No hidden USD fees. Pay in PKR via JazzCash, EasyPaisa, or card — monthly or annually.
          </motion.p>
        </div>

        {/* Toggle */}
        <motion.div variants={fadeUp} className="flex items-center justify-center gap-3">
          <span className={`text-sm ${!annual ? "text-foreground font-semibold" : "text-muted-foreground"}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative h-7 w-12 rounded-full transition-colors ${annual ? "bg-primary" : "bg-muted"}`}
            aria-label="Toggle annual billing"
          >
            <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-background transition-transform ${annual ? "translate-x-5" : ""}`} />
          </button>
          <span className={`text-sm ${annual ? "text-foreground font-semibold" : "text-muted-foreground"}`}>Annual</span>
          {annual && <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Save 20%</span>}
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {PKR_PLANS.map((plan) => {
            const price = annual ? plan.annual : plan.monthly;
            return (
              <motion.div key={plan.key} variants={fadeUp}
                className={`glass-card rounded-xl p-8 text-left space-y-6 relative will-change-transform transition-all duration-300 hover:scale-[1.02] overflow-hidden ${plan.highlighted ? "ring-2 ring-primary" : ""}`}
                style={plan.highlighted ? { boxShadow: "0 0 40px -10px hsl(var(--aurora-violet) / 0.3)" } : undefined}
              >
                {plan.badge && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full ${plan.highlighted ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"}`}>
                    {plan.badge}
                  </span>
                )}
                <div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-3xl font-extrabold mt-2 data-mono">
                    {plan.currency}{price.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  {annual && price > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Billed annually</p>
                  )}
                </div>
                <ul className="space-y-3 text-sm">
                  {plan.features.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link to={plan.key === "business" ? "mailto:sales@influenceiq.pk" : ctaPath} className="block">
                  <Button className={`w-full ${plan.highlighted ? "btn-shine" : ""}`} variant={plan.highlighted ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </Link>
                {plan.key === "free" && (
                  <p className="text-xs text-center text-muted-foreground">No credit card required</p>
                )}
              </motion.div>
            );
          })}
        </div>

        <motion.p variants={fadeUp} className="text-xs text-muted-foreground">
          💳 Pay via <strong className="text-foreground">JazzCash</strong>, <strong className="text-foreground">EasyPaisa</strong>, or international card · All prices in Pakistani Rupees (PKR) · VAT may apply
        </motion.p>
      </motion.div>
    </section>
  );
}
