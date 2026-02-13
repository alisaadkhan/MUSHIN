import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Hero } from "@/components/marketing/Hero";
import { OutcomeMetrics } from "@/components/marketing/OutcomeMetrics";
import { ProblemSolution } from "@/components/marketing/ProblemSolution";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Features } from "@/components/marketing/Features";
import { Testimonials } from "@/components/marketing/Testimonials";
import { PricingPreview } from "@/components/marketing/PricingPreview";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function LandingPage() {
  const { user } = useAuth();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const ctaPath = user ? "/dashboard" : "/auth";
  const ctaLabel = user ? "Go to Dashboard" : "Start Free Trial";

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Aurora blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -right-60 h-[700px] w-[700px] rounded-full opacity-20 blur-[140px] animate-aurora-float" style={{ background: "hsl(var(--aurora-violet))" }} />
        <div className="absolute -bottom-60 -left-60 h-[600px] w-[600px] rounded-full opacity-15 blur-[140px] animate-aurora-float" style={{ background: "hsl(var(--aurora-teal))", animationDelay: "-5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full opacity-10 blur-[120px]" style={{ background: "hsl(var(--aurora-violet))" }} />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl border-b" style={{ borderColor: "hsl(var(--glass-border))", background: "hsl(var(--glass-bg))" }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              <span className="aurora-text">Influence</span><span>IQ</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            {!user && (
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                Log In
              </Link>
            )}
            <Link to={ctaPath}>
              <Button size="sm" className="btn-shine">{ctaLabel} <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Sections */}
      <Hero ctaPath={ctaPath} ctaLabel={ctaLabel} />
      <OutcomeMetrics />
      <ProblemSolution />
      <HowItWorks />
      <Features />
      <Testimonials />
      <PricingPreview ctaPath={ctaPath} />
      <FAQ />
      <FinalCTA ctaPath={ctaPath} />
      <MarketingFooter />
    </div>
  );
}
