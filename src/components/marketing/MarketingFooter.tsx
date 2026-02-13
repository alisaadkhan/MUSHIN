import { Zap, Twitter, Linkedin, Github } from "lucide-react";

interface MarketingFooterProps {
  onScrollToFeatures: () => void;
}

export function MarketingFooter({ onScrollToFeatures }: MarketingFooterProps) {
  return (
    <footer className="border-t py-12 px-6" style={{ borderColor: "hsl(var(--glass-border))" }}>
      <div className="max-w-6xl mx-auto grid sm:grid-cols-4 gap-8 text-sm text-muted-foreground">
        {/* Brand */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">
              <span className="aurora-text">Influence</span>IQ
            </span>
          </div>
          <p className="text-xs">Live influencer discovery for modern agencies.</p>
          <div className="flex items-center gap-3 pt-2">
            <Twitter className="h-4 w-4 hover:text-foreground transition-colors cursor-pointer" />
            <Linkedin className="h-4 w-4 hover:text-foreground transition-colors cursor-pointer" />
            <Github className="h-4 w-4 hover:text-foreground transition-colors cursor-pointer" />
          </div>
        </div>

        {/* Product */}
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Product</h4>
          <button onClick={onScrollToFeatures} className="block hover:text-foreground transition-colors">Features</button>
          <a href="#pricing" className="block hover:text-foreground transition-colors">Pricing</a>
          <a href="#how-it-works" className="block hover:text-foreground transition-colors">How It Works</a>
        </div>

        {/* Company */}
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Company</h4>
          <span className="block">About</span>
          <span className="block">Blog</span>
          <span className="block">Careers</span>
        </div>

        {/* Legal */}
        <div className="space-y-2">
          <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Legal</h4>
          <span className="block">Privacy Policy</span>
          <span className="block">Terms of Service</span>
          <span className="block">Cookie Policy</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-8 pt-6 border-t text-center text-xs text-muted-foreground" style={{ borderColor: "hsl(var(--glass-border))" }}>
        © {new Date().getFullYear()} InfluenceIQ. All rights reserved.
      </div>
    </footer>
  );
}
