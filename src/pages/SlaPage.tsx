import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function SlaPage() {
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
        <h1>Service Level Agreement (SLA)</h1>
        <p className="text-muted-foreground">Last updated: April 2026</p>

        <h2>1. Uptime Commitment</h2>
        <p>MUSHIN guarantees a 99.9% monthly uptime for its core services, excluding scheduled maintenance windows.</p>

        <h2>2. Incident Response</h2>
        <p>In the event of a critical outage, our engineering team will respond within 4 hours. Non-critical issues have a standard response time of 24 hours.</p>

        <h2>3. Service Credits</h2>
        <p>If we fail to meet the uptime commitment in a given billing month, eligible customers may request a prorated service credit towards their next billing cycle.</p>
      </main>

      <MarketingFooter />
    </div>
  );
}
