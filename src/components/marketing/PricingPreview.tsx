import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.12 } } };

interface Props {
  ctaPath: string;
}

export function PricingPreview({ ctaPath }: Props) {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto text-center space-y-16"
      >
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
          Simple, Transparent <span className="aurora-text">Pricing</span>
        </motion.h2>

        {/* Annual/Monthly toggle */}
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
          {annual && (
            <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Save 20%</span>
          )}
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {(Object.entries(PLANS) as [string, (typeof PLANS)["free"]][]).map(([key, plan]) => {
            const isPro = key === "pro";
            const isBusiness = key === "business";
            const displayPrice = annual ? Math.round(plan.price * 0.8) : plan.price;

            return (
              <motion.div key={key} variants={fadeUp}
                className={`glass-card rounded-xl p-8 text-left space-y-6 relative will-change-transform transition-transform duration-200 hover:scale-[1.02] ${isPro ? "ring-2 ring-primary" : ""}`}
              >
                {isPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                {isBusiness && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent/20 text-accent text-xs font-bold px-3 py-1 rounded-full">
                    Priority Support
                  </span>
                )}
                <div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-3xl font-extrabold mt-2 data-mono">
                    ${displayPrice}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  {annual && plan.price > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Billed annually</p>
                  )}
                </div>
                <ul className="space-y-3 text-sm">
                  {[
                    `${plan.search_credits} search credits`,
                    `${plan.enrichment_credits} enrichment credits`,
                    `${plan.campaigns === Infinity ? "Unlimited" : plan.campaigns} campaigns`,
                    `${plan.email_sends} emails/mo`,
                    `${plan.ai_credits === Infinity ? "Unlimited" : plan.ai_credits} AI insights`,
                    `${plan.team_members} team member${plan.team_members > 1 ? "s" : ""}`,
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link to={ctaPath} className="block">
                  <Button className={`w-full ${isPro ? "btn-shine" : ""}`} variant={isPro ? "default" : "outline"}>
                    Get Started
                  </Button>
                </Link>
                {key === "free" && (
                  <p className="text-xs text-center text-muted-foreground">No credit card required</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
