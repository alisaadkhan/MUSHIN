import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function SaaSSubscriptionPage() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="fixed inset-0 -z-10 animated-mesh-bg" />
      <div className="fixed inset-0 -z-10 dot-grid-overlay" />

      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ borderColor: "hsl(var(--glass-border))", background: "hsl(var(--glass-bg))" }}>
        <div className="max-w-5xl mx-auto flex items-center gap-4 h-14 px-6">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-4 w-4" /> Back</Link>
          <Link to="/" className="flex items-center gap-2 ml-auto">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary"><Zap className="h-3.5 w-3.5 text-primary-foreground" /></div>
            <span className="font-bold tracking-[0.14em]">MUSHIN</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-20 prose prose-invert prose-sm">
        <h1>SaaS Subscription Agreement</h1>
        <p className="text-muted-foreground">Last updated: April 2026</p>

        <h2>1. Scope of Agreement</h2>
        <p>This SaaS Subscription Agreement governs the terms of service, billing cycles, and specific deliverables provided to clients subscribing to the MUSHIN platform. It supplements the general Terms of Service.</p>

        <h2>2. Subscription Tiers and Features</h2>
        <p>Your chosen subscription tier dictates usage limits, API access, and feature availability. Downgrading may result in data loss or reduced access.</p>

        <h2>3. Renewal and Cancellation</h2>
        <p>Subscriptions automatically renew unless canceled prior to the next billing date. Prorated refunds are not issued for mid-cycle cancellations.</p>
      </main>

      <MarketingFooter />
    </div>
  );
}
