import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function AupPage() {
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
            <span className="font-bold"><span className="aurora-text">Influence</span>IQ</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-20 prose prose-invert prose-sm">
        <h1>Acceptable Use Policy (AUP)</h1>
        <p className="text-muted-foreground">Last updated: April 2026</p>

        <h2>1. Prohibited Actions</h2>
        <p>Users may not use MUSHIN to scrape, extract, or mine data programmatically beyond the provided API constraints. Malicious activities, including DDoS attacks or spreading malware, will result in immediate termination.</p>

        <h2>2. Data Usage</h2>
        <p>The analytics and metrics provided by MUSHIN may not be resold or redistributed without a specific Enterprise Data License.</p>

        <h2>3. Harassment and Abuse</h2>
        <p>We do not tolerate harassment or abuse toward MUSHIN staff or any creators sourced through our platform.</p>
      </main>

      <MarketingFooter />
    </div>
  );
}
