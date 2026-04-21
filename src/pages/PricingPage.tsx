import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MushInIcon } from "@/components/ui/MushInLogo";

export default function PricingPage() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const [pricePeriod, setPricePeriod] = useState<"m" | "a">("m");

  const plans = [
    {
      name: "Pro",
      price: { m: 4999, a: 3999 },
      desc: "For brands running active campaigns.",
      features: [
        "500 search credits/mo",
        "100 enrichment credits/mo",
        "500 email sends/mo",
        "Real-time scoring",
        "MUSHIN score accuracy: 85%",
        "Team members: 3",
      ],
      cta: "Start Pro",
      highlight: true,
    },
    {
      name: "Business",
      price: { m: 14999, a: 11999 },
      desc: "For agencies managing multiple brands.",
      features: [
        "2,000 search credits/mo",
        "500 enrichment credits/mo",
        "2,000 email sends/mo",
        "Unlimited AI insights",
        "Real-time scoring",
        "MUSHIN score accuracy: 92%",
        "Team members: 10",
      ],
      cta: "Start Business",
      highlight: false,
    },
    {
      name: "Enterprise",
      price: { m: 39999, a: 31999 },
      desc: "For large teams and high-volume research.",
      features: [
        "10,000 search credits/mo",
        "2,500 enrichment credits/mo",
        "10,000 email sends/mo",
        "Unlimited AI insights",
        "Real-time scoring",
        "MUSHIN score accuracy: 96%",
        "Team members: 50",
        "Priority support",
      ],
      cta: "Contact Sales",
      highlight: false,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-[#060608] text-white overflow-x-hidden">
      <div className="fixed inset-0 -z-10 animated-mesh-bg" />
      <div className="fixed inset-0 -z-10 dot-grid-overlay" />

      <nav
        className="sticky top-0 z-50 backdrop-blur-xl border-b"
        style={{
          borderColor: "rgba(255,255,255,0.06)",
          background: "rgba(6,6,8,0.75)",
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-4 h-14 px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Link to="/" className="flex items-center gap-2 ml-auto">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600">
              <MushInIcon size={16} className="text-white" />
            </div>
            <span className="font-bold tracking-[0.14em]">MUSHIN</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">
            Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
            Pro, Business, Enterprise
          </h1>
          <p className="text-zinc-400 text-lg mt-4 max-w-2xl mx-auto">
            Choose a plan to activate credits and real-time scoring.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8" role="group" aria-label="Billing period">
            <button
              aria-pressed={pricePeriod === "m"}
              onClick={() => setPricePeriod("m")}
              className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all ${
                pricePeriod === "m" ? "bg-white text-black" : "text-white/60 hover:text-white/80"
              }`}
            >
              Monthly
            </button>
            <button
              aria-pressed={pricePeriod === "a"}
              onClick={() => setPricePeriod("a")}
              className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all ${
                pricePeriod === "a" ? "bg-white text-black" : "text-white/60 hover:text-white/80"
              }`}
            >
              Annual <span className="text-green-400">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className={`relative rounded-2xl border p-7 flex flex-col ${
                plan.highlight ? "border-purple-500/40 bg-purple-500/[0.06]" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-purple-600 text-white text-[10px] font-bold uppercase tracking-widest">
                  Most Popular
                </div>
              )}
              <div className="mb-5">
                <div className="text-sm font-bold text-white/60 mb-1">{plan.name}</div>
                <div className="flex items-end gap-1.5">
                  <span className="text-4xl font-black text-white">
                    Rs {(pricePeriod === "m" ? plan.price.m : plan.price.a).toLocaleString()}
                  </span>
                  <span className="text-white/30 text-sm mb-1">/mo</span>
                </div>
                <div className="text-zinc-500 text-xs mt-1">{plan.desc}</div>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <CheckCircle className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/auth"
                className={`block text-center py-3 rounded-full text-sm font-bold transition-all ${
                  plan.highlight
                    ? "bg-purple-600 hover:bg-purple-500 text-white"
                    : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 text-center text-zinc-500 text-sm">
          Refunds are not offered. You can cancel anytime and keep access until the end of your billing period.{" "}
          <Link to="/refunds" className="text-purple-400 hover:text-purple-300 font-semibold">
            Refund Policy
          </Link>
          .
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

