import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Hero } from "@/components/marketing/Hero";
import { OutcomeMetrics } from "@/components/marketing/OutcomeMetrics";
import { ProblemSolution } from "@/components/marketing/ProblemSolution";
import { Differentiation } from "@/components/marketing/Differentiation";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Features } from "@/components/marketing/Features";
import { ProductDemo } from "@/components/marketing/ProductDemo";
import { TrustSecurity } from "@/components/marketing/TrustSecurity";
import { PricingPreview } from "@/components/marketing/PricingPreview";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function LandingPage() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const ctaPath = user ? "/dashboard" : "/auth";
  const ctaLabel = user ? "Go to Dashboard" : "Start Free Trial";

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" style={{ scrollBehavior: "smooth", scrollPaddingTop: "80px" }}>
      {/* Animated mesh background */}
      <div className="fixed inset-0 -z-10 animated-mesh-bg" />
      <div className="fixed inset-0 -z-10 dot-grid-overlay" />
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-60 -right-60 h-[700px] w-[700px] rounded-full opacity-[0.12] blur-[140px]" style={{ background: "hsl(var(--aurora-violet))" }} />
        <div className="absolute -bottom-60 -left-60 h-[600px] w-[600px] rounded-full opacity-[0.1] blur-[140px]" style={{ background: "hsl(var(--aurora-teal))" }} />
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
            <button onClick={() => scrollTo("features")} className="hover:text-foreground transition-colors">Features</button>
            <button onClick={() => scrollTo("pricing")} className="hover:text-foreground transition-colors">Pricing</button>
            <button onClick={() => scrollTo("faq")} className="hover:text-foreground transition-colors">FAQ</button>
          </div>
          <div className="flex items-center gap-4">
            {!user && (
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                Log In
              </Link>
            )}
            <Link to={ctaPath} className="hidden sm:block">
              <Button size="sm" className="btn-shine">{ctaLabel} <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </Link>
            <button className="md:hidden p-1" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t px-6 py-4 space-y-3 text-sm" style={{ borderColor: "hsl(var(--glass-border))", background: "hsl(240 10% 4% / 0.95)" }}>
            <button onClick={() => scrollTo("features")} className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors">Features</button>
            <button onClick={() => scrollTo("pricing")} className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors">Pricing</button>
            <button onClick={() => scrollTo("faq")} className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors">FAQ</button>
            {!user && (
              <Link to="/auth" className="block text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMenuOpen(false)}>Log In</Link>
            )}
            <Link to={ctaPath} onClick={() => setMenuOpen(false)}>
              <Button size="sm" className="w-full mt-2">{ctaLabel}</Button>
            </Link>
          </div>
        )}
      </nav>

      {/* Sections */}
      <Hero ctaPath={ctaPath} ctaLabel={ctaLabel} />
      <div className="section-divider" />
      <OutcomeMetrics />
      <div className="section-divider" />
      <ProblemSolution />
      <div className="section-divider" />
      <Differentiation />
      <div className="section-divider" />
      <HowItWorks />
      <div className="section-divider" />
      <Features />
      <div className="section-divider" />
      <ProductDemo />
      <div className="section-divider" />
      <TrustSecurity />
      <div className="section-divider" />
      <PricingPreview ctaPath={ctaPath} />
      <div className="section-divider" />
      <FAQ />
      <div className="section-divider" />
      <FinalCTA ctaPath={ctaPath} />
      <MarketingFooter />
    </div>
  );
}
