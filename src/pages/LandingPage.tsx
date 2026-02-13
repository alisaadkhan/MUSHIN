import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useInView, type Variants } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { PLANS } from "@/lib/plans";
import {
  Zap, Search, ShieldCheck, Mail, BarChart3, Users, Megaphone,
  ArrowRight, Lock, CreditCard, CheckCircle2, Globe, Star,
  TrendingUp, Eye, MousePointerClick
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ────────── animation helpers ────────── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};
const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ────────── animated counter ────────── */
function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <motion.span
      className="data-mono text-3xl font-bold text-foreground"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      {value.toLocaleString()}{suffix}
    </motion.span>
  );
}

/* ────────── section wrapper ────────── */
function Section({ id, children, className = "" }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`relative py-24 px-6 md:px-12 lg:px-24 ${className}`}>
      {children}
    </section>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const ctaPath = user ? "/dashboard" : "/auth";
  const ctaLabel = user ? "Go to Dashboard" : "Start Free";

  const scrollToFeatures = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Aurora blobs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -right-60 h-[700px] w-[700px] rounded-full opacity-20 blur-[140px] animate-aurora-float" style={{ background: "hsl(var(--aurora-violet))" }} />
        <div className="absolute -bottom-60 -left-60 h-[600px] w-[600px] rounded-full opacity-15 blur-[140px] animate-aurora-float" style={{ background: "hsl(var(--aurora-teal))", animationDelay: "-5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full opacity-10 blur-[120px]" style={{ background: "hsl(var(--aurora-violet))" }} />
      </div>

      {/* ──── NAV ──── */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl border-b" style={{ borderColor: "hsl(var(--glass-border))", background: "hsl(var(--glass-bg))" }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary"><Zap className="h-4 w-4 text-primary-foreground" /></div>
            <span className="text-lg font-bold tracking-tight"><span className="aurora-text">Influence</span><span>IQ</span></span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <button onClick={scrollToFeatures} className="hover:text-foreground transition-colors">Features</button>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <Link to={ctaPath}>
            <Button size="sm" className="btn-shine">{ctaLabel} <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </Link>
        </div>
      </nav>

      {/* ──── HERO ──── */}
      <Section className="pt-40 pb-32 text-center">
        <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-4xl mx-auto space-y-8">
          <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
            Find <span className="aurora-text">Real Influencers</span>. Instantly.
          </motion.h1>
          <motion.p variants={fadeUp} className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Live influencer discovery with fraud detection, real engagement metrics, and agency‑ready workflows. No stale databases. No locked contracts.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={ctaPath}><Button size="lg" className="btn-shine text-base px-8 py-6">{ctaLabel} <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Button size="lg" variant="outline" className="text-base px-8 py-6" onClick={scrollToFeatures}>See How It Works</Button>
          </motion.div>
        </motion.div>
      </Section>

      {/* ──── TRUST SIGNALS ──── */}
      <Section className="py-16">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-5xl mx-auto text-center space-y-10">
          <motion.p variants={fadeUp} className="text-sm uppercase tracking-widest text-muted-foreground">Trusted by agencies & brands worldwide</motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-12 opacity-40">
            {["Agency One", "BrandCo", "MediaHub", "CreatorX", "AdFlow"].map(name => (
              <span key={name} className="text-lg font-semibold tracking-wide">{name}</span>
            ))}
          </motion.div>
          <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-4">
            {[{ val: 10000, suffix: "+", label: "Live searches performed" }, { val: 99, suffix: "%", label: "Fraud detection accuracy" }, { val: 90, suffix: "%", label: "Lower cost vs. legacy tools" }].map(s => (
              <div key={s.label} className="glass-card p-6 rounded-xl text-center">
                <Counter value={s.val} suffix={s.suffix} />
                <p className="text-sm text-muted-foreground mt-2">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </Section>

      {/* ──── PROBLEM / SOLUTION ──── */}
      <Section>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-6xl mx-auto">
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-center mb-16">
            The Old Way vs. <span className="aurora-text">The InfluenceIQ Way</span>
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Problems */}
            <motion.div variants={fadeUp} className="space-y-4">
              {["Stale influencer databases updated monthly", "Fake followers slip through without detection", "Locked annual contracts with hidden fees"].map(p => (
                <div key={p} className="glass-card p-5 rounded-xl flex items-start gap-3 border-destructive/20">
                  <span className="text-destructive mt-0.5">✕</span>
                  <p className="text-muted-foreground">{p}</p>
                </div>
              ))}
            </motion.div>
            {/* Solutions */}
            <motion.div variants={fadeUp} className="space-y-4">
              {["Live Google‑powered discovery — always fresh", "Real‑time fraud scoring with AI analysis", "Pay‑as‑you‑go credits — cancel anytime"].map(s => (
                <div key={s} className="glass-card p-5 rounded-xl flex items-start gap-3" style={{ borderColor: "hsl(var(--aurora-teal) / 0.3)" }}>
                  <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <p className="text-foreground">{s}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </Section>

      {/* ──── HOW IT WORKS ──── */}
      <Section id="how-it-works">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-5xl mx-auto text-center space-y-16">
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold">
            How It Works
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { icon: Search, title: "Search Live", desc: "Enter a niche, platform, and location. Get real influencer profiles from the web instantly." },
              { icon: ShieldCheck, title: "Analyze Trust", desc: "AI‑powered fraud scores, engagement metrics, and email extraction — all in one click." },
              { icon: Mail, title: "Shortlist & Contact", desc: "Save to lists, manage campaigns on a Kanban board, and send outreach emails directly." },
            ].map((step, i) => (
              <motion.div key={step.title} variants={fadeUp} className="glass-card p-8 rounded-xl space-y-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl aurora-gradient">
                  <step.icon className="h-7 w-7 text-primary" />
                </div>
                <p className="data-mono text-xs text-muted-foreground">Step {i + 1}</p>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* ──── FEATURE HIGHLIGHTS ──── */}
      <Section>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-6xl mx-auto text-center space-y-16">
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold">
            Everything You Need to <span className="aurora-text">Win</span>
          </motion.h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" ref={featuresRef}>
            {[
              { icon: Globe, title: "Live Influencer Search", desc: "Google‑powered discovery across Instagram, TikTok, and YouTube." },
              { icon: ShieldCheck, title: "Fraud Detection", desc: "AI fraud scoring identifies fake followers and inflated engagement." },
              { icon: Mail, title: "Email Extraction", desc: "Find contact emails with source badges for quick outreach." },
              { icon: Megaphone, title: "Campaign Kanban", desc: "Drag‑and‑drop pipeline to manage influencer partnerships." },
              { icon: MousePointerClick, title: "Outreach Automation", desc: "Email templates with variable substitution and open tracking." },
              { icon: BarChart3, title: "Analytics & ROI", desc: "Cross‑campaign dashboards with conversion and budget insights." },
            ].map(f => (
              <motion.div key={f.title} variants={fadeUp} className="glass-card-hover p-6 rounded-xl text-left space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg aurora-gradient">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* ──── PRICING ──── */}
      <Section id="pricing">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-5xl mx-auto text-center space-y-16">
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold">
            Simple, Transparent <span className="aurora-text">Pricing</span>
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-6">
            {(Object.entries(PLANS) as [string, typeof PLANS.free][]).map(([key, plan]) => {
              const isPro = key === "pro";
              return (
                <motion.div
                  key={key}
                  variants={fadeUp}
                  className={`glass-card rounded-xl p-8 text-left space-y-6 relative ${isPro ? "ring-2 ring-primary" : ""}`}
                >
                  {isPro && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">Most Popular</span>}
                  <div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-3xl font-extrabold mt-2 data-mono">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  </div>
                  <ul className="space-y-3 text-sm">
                    {[
                      `${plan.search_credits} search credits`,
                      `${plan.enrichment_credits} enrichment credits`,
                      `${plan.campaigns === Infinity ? "Unlimited" : plan.campaigns} campaigns`,
                      `${plan.email_sends} emails/mo`,
                      `${plan.ai_credits === Infinity ? "Unlimited" : plan.ai_credits} AI insights`,
                      `${plan.team_members} team member${plan.team_members > 1 ? "s" : ""}`,
                    ].map(item => (
                      <li key={item} className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                  <Link to={ctaPath} className="block">
                    <Button className={`w-full ${isPro ? "btn-shine" : ""}`} variant={isPro ? "default" : "outline"}>
                      Get Started
                    </Button>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </Section>

      {/* ──── SECURITY ──── */}
      <Section className="py-16">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: Lock, title: "GDPR Ready", desc: "Data export and account deletion built in." },
              { icon: CreditCard, title: "Secure Payments", desc: "Powered by Stripe with PCI compliance." },
              { icon: Eye, title: "Transparent Usage", desc: "Real‑time credit tracking and audit logs." },
            ].map(s => (
              <motion.div key={s.title} variants={fadeUp} className="glass-card p-6 rounded-xl space-y-3">
                <s.icon className="h-6 w-6 text-accent mx-auto" />
                <h3 className="font-semibold text-sm">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* ──── FINAL CTA ──── */}
      <Section>
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-3xl mx-auto text-center space-y-8 aurora-gradient rounded-3xl p-12 md:p-16">
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold">
            Stop Guessing. Start Partnering with <span className="aurora-text">Real Creators</span>.
          </motion.h2>
          <motion.div variants={fadeUp}>
            <Link to={ctaPath}><Button size="lg" className="btn-shine text-base px-10 py-6">Get Started Free <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </motion.div>
        </motion.div>
      </Section>

      {/* ──── FOOTER ──── */}
      <footer className="border-t py-12 px-6" style={{ borderColor: "hsl(var(--glass-border))" }}>
        <div className="max-w-6xl mx-auto grid sm:grid-cols-4 gap-8 text-sm text-muted-foreground">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary"><Zap className="h-3.5 w-3.5 text-primary-foreground" /></div>
              <span className="font-bold text-foreground"><span className="aurora-text">Influence</span>IQ</span>
            </div>
            <p className="text-xs">Live influencer discovery for modern agencies.</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Product</h4>
            <button onClick={scrollToFeatures} className="block hover:text-foreground transition-colors">Features</button>
            <a href="#pricing" className="block hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Company</h4>
            <span className="block">About</span>
            <span className="block">Blog</span>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Legal</h4>
            <span className="block">Privacy Policy</span>
            <span className="block">Terms of Service</span>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t text-center text-xs text-muted-foreground" style={{ borderColor: "hsl(var(--glass-border))" }}>
          © {new Date().getFullYear()} InfluenceIQ. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
