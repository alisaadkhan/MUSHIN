import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function TermsPage() {
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
        <h1>Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: February 2026</p>

        <h2>1. Acceptance</h2>
        <p>By using MUSHIN, you agree to these terms. If you do not agree, please do not use the platform.</p>

        <h2>2. Service Description</h2>
        <p>MUSHIN provides influencer discovery, campaign management, and analytics tools. Features vary by subscription plan.</p>

        <h2>3. User Responsibilities</h2>
        <p>You are responsible for maintaining the security of your account credentials and for all activity under your account.</p>

        <h2>4. Payment & Billing</h2>
        <p>Paid plans are billed monthly or annually. You may cancel at any time; access continues until the end of the billing period.</p>

        <h2>5. Limitation of Liability</h2>
        <p>MUSHIN is provided "as is". We are not liable for indirect, incidental, or consequential damages arising from use of the service.</p>

        <h2>6. Changes to Terms</h2>
        <p>We may update these terms periodically. Continued use of the service constitutes acceptance of the updated terms.</p>
      </main>

      <MarketingFooter />
    </div>
  );
}
