import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function PrivacyPage() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
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
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: February 2026</p>

        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly, such as your name, email address, and billing details when you create an account or subscribe to a plan.</p>

        <h2>2. How We Use Your Information</h2>
        <p>We use your information to provide and improve our services, process payments, send transactional emails, and ensure platform security.</p>

        <h2>3. Data Sharing</h2>
        <p>We do not sell your personal data. We share data only with service providers necessary to operate the platform (e.g., payment processors, email delivery).</p>

        <h2>4. Data Retention</h2>
        <p>We retain your data for as long as your account is active. You may request deletion of your account and associated data at any time.</p>

        <h2>5. Security</h2>
        <p>We implement industry-standard security measures including encryption at rest and in transit, role-based access control, and regular security audits.</p>

        <h2>6. Contact</h2>
        <p>For privacy-related inquiries, contact us at <span className="text-primary">privacy@influenceiq.com</span>.</p>
      </main>

      <MarketingFooter />
    </div>
  );
}
