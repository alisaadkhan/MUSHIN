import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function NdaPage() {
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
        <h1>Non-Disclosure Agreement (NDA)</h1>
        <p className="text-muted-foreground">Last updated: April 2026</p>

        <h2>1. Confidential Information</h2>
        <p>Both parties agree not to disclose confidential information obtained during the course of using or providing the MUSHIN service, including proprietary algorithms, business strategies, and unpublished metrics.</p>

        <h2>2. Obligations</h2>
        <p>The Receiving Party shall exercise the same degree of care to protect the Confidential Information as it exercises to protect its own similar information.</p>

        <h2>3. Term of Confidentiality</h2>
        <p>The duty of confidentiality remains in effect for a period of 5 years following the termination of access to the platform.</p>
      </main>

      <MarketingFooter />
    </div>
  );
}
