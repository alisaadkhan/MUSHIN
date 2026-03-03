import { Link } from "react-router-dom";
import { Zap, Lock, Shield, CreditCard, Phone } from "lucide-react";

const TRUST_BAR = [
  { icon: Lock, label: "GDPR Compliant" },
  { icon: Shield, label: "SOC2 Ready" },
  { icon: CreditCard, label: "JazzCash & EasyPaisa" },
  { icon: Phone, label: "+92 321 9876543" },
];

export function MarketingFooter() {
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <footer className="border-t py-14 px-6" style={{ borderColor: "hsl(var(--glass-border))" }}>
      {/* Trust bar */}
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-8 mb-10 pb-10 border-b" style={{ borderColor: "hsl(var(--glass-border))" }}>
        {TRUST_BAR.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-10 text-sm text-muted-foreground">
        {/* Brand */}
        <div className="col-span-2 sm:col-span-1 space-y-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><path d="M16 2 L30 16 L16 30 L2 16 Z" stroke="#A855F7" strokeWidth="1.5" fill="rgba(168,85,247,0.15)"/><path d="M16 6 L24 16 L16 16 Z" fill="#C084FC" opacity="0.9"/><circle cx="16" cy="16" r="2" fill="#A855F7"/></svg>
            </div>
            <span className="font-bold text-foreground">
              MUSHIN
            </span>
          </Link>
          <p className="text-xs leading-relaxed">
            Pakistan's #1 influencer marketing intelligence platform. Built for brands and agencies operating in the Pakistani creator economy.
          </p>
          <p className="text-xs text-muted-foreground">
            📞 <a href="tel:+923219876543" className="hover:text-foreground transition-colors">+92 321 9876543</a>
          </p>
          <div className="flex items-center gap-3">
            <a href="#" aria-label="Twitter/X" className="hover:text-foreground transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            <a href="#" aria-label="LinkedIn" className="hover:text-foreground transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </a>
          </div>
        </div>

        {/* Product */}
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-[0.15em]">Product</h4>
          <button onClick={() => scrollTo("features")} className="block hover:text-foreground transition-colors">Features</button>
          <button onClick={() => scrollTo("pricing")} className="block hover:text-foreground transition-colors">Pricing</button>
          <button onClick={() => scrollTo("faq")} className="block hover:text-foreground transition-colors">FAQ</button>
        </div>

        {/* Company */}
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-[0.15em]">Company</h4>
          <Link to="/about" className="block hover:text-foreground transition-colors">About</Link>
          <Link to="/blog" className="block hover:text-foreground transition-colors">Blog</Link>
          <a href="mailto:sales@mushin.pk" className="block hover:text-foreground transition-colors">Contact</a>
        </div>

        {/* Legal */}
        <div className="space-y-3">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-[0.15em]">Legal (Pakistan)</h4>
          <Link to="/privacy" className="block hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="block hover:text-foreground transition-colors">Terms of Service</Link>
          <Link to="/cookies" className="block hover:text-foreground transition-colors">Cookie Policy</Link>
        </div>
      </div>

      <div
        className="max-w-6xl mx-auto mt-10 pt-6 border-t text-center text-xs text-muted-foreground"
        style={{ borderColor: "hsl(var(--glass-border))" }}
      >
        © {new Date().getFullYear()} MUSHIN Pakistan. All rights reserved. · Registered in Pakistan · Prices shown in PKR
      </div>
    </footer>
  );
}
