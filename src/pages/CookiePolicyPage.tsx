import { useEffect } from "react";
import { SEO } from "@/components/SEO";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function CookiePolicyPage() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <SEO title="Cookie Policy" description="How MUSHIN uses cookies." />
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
        <h1>Cookie Policy</h1>
        <p className="text-muted-foreground">Last updated: February 2026</p>

        <h2>1. What Are Cookies</h2>
        <p>Cookies are small text files stored on your device when you visit a website. They help us provide a better experience.</p>

        <h2>2. Cookies We Use</h2>
        <ul>
          <li><strong>Essential cookies:</strong> Required for authentication and core functionality.</li>
          <li><strong>Analytics cookies:</strong> Help us understand usage patterns to improve the platform.</li>
          <li><strong>Preference cookies:</strong> Remember your settings and preferences.</li>
        </ul>

        <h2>3. Managing Cookies</h2>
        <p>You can control cookies through your browser settings. Disabling essential cookies may affect platform functionality.</p>

        <h2>4. Contact</h2>
        <p>Questions about our cookie practices? Reach us at <span className="text-primary">privacy@mushin.com</span>.</p>
      </main>

      <MarketingFooter />
    </div>
  );
}
