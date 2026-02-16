import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, ArrowLeft, Users, Target, Sparkles } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function AboutPage() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 animated-mesh-bg" />
      <div className="fixed inset-0 -z-10 dot-grid-overlay" />

      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{ borderColor: "hsl(var(--glass-border))", background: "hsl(var(--glass-bg))" }}>
        <div className="max-w-5xl mx-auto flex items-center gap-4 h-14 px-6">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <Link to="/" className="flex items-center gap-2 ml-auto">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary"><Zap className="h-3.5 w-3.5 text-primary-foreground" /></div>
            <span className="font-bold"><span className="aurora-text">Influence</span>IQ</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-20 space-y-16">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">About InfluenceIQ</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">We're building the most intelligent influencer discovery and campaign management platform for brands in Pakistan and beyond.</p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { icon: Target, title: "Our Mission", desc: "Empower brands to find authentic influencers, manage campaigns efficiently, and measure real ROI." },
            { icon: Users, title: "Our Team", desc: "A passionate team of marketers, engineers, and data scientists dedicated to transforming influencer marketing." },
            { icon: Sparkles, title: "Our Vision", desc: "A world where every brand can access transparent, data-driven influencer partnerships at any scale." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card rounded-xl p-6 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="h-5 w-5 text-primary" /></div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
