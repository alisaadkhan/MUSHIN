import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MushInIcon } from "@/components/ui/MushInLogo";

export default function RefundPolicyPage() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="fixed inset-0 -z-10 animated-mesh-bg" />
      <div className="fixed inset-0 -z-10 dot-grid-overlay" />

      <nav
        className="sticky top-0 z-50 backdrop-blur-xl border-b"
        style={{
          borderColor: "hsl(var(--glass-border))",
          background: "hsl(var(--glass-bg))",
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-4 h-14 px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Link to="/" className="flex items-center gap-2 ml-auto">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <MushInIcon size={16} className="text-primary-foreground" />
            </div>
            <span className="font-bold tracking-[0.14em]">MUSHIN</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-20 prose prose-invert prose-sm">
        <h1>Refund Policy</h1>
        <p className="text-muted-foreground">Last updated: April 2026</p>

        <h2>1. No Refunds</h2>
        <p>
          MUSHIN does not offer refunds for subscriptions, credits, or any other fees.
        </p>

        <h2>2. Cancellation</h2>
        <p>
          You may cancel your subscription at any time. After cancellation, you will
          retain access until the end of your current billing period.
        </p>

        <h2>3. Charge Disputes</h2>
        <p>
          If you believe you were charged in error, contact support with the payment
          receipt and relevant details. We may investigate and correct billing errors,
          but this policy does not guarantee a refund.
        </p>

        <h2>4. Third-Party Payment Providers</h2>
        <p>
          Payments may be processed by third-party providers. Any provider-specific
          rules may apply in addition to this policy.
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}

