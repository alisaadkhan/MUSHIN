import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function DpaPage() {
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
        <h1>Data Processing Agreement (DPA)</h1>
        <p className="text-muted-foreground">Last updated: April 2026</p>

        <h2>1. Controller and Processor</h2>
        <p>This Data Processing Agreement outlines the terms under which MUSHIN (Processor) processes personal data on behalf of your organization (Controller).</p>

        <h2>2. Data Subject Rights</h2>
        <p>We will assist you by appropriate technical and organizational measures, insofar as this is possible, for the fulfilment of your obligation to respond to requests for exercising the data subject's rights laid down in current privacy laws.</p>

        <h2>3. Security Measures</h2>
        <p>MUSHIN implements robust technical and organizational security measures to protect data against accidental or unlawful destruction, loss, alteration, and unauthorized disclosure.</p>
      </main>

      <MarketingFooter />
    </div>
  );
}
