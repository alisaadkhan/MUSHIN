import { Link } from 'react-router-dom';
import { Instagram, Youtube, Globe } from 'lucide-react';
import { MushInLogo } from '@/components/ui/MushInLogo';

/**
 * Slim marketing footer used on legal/blog pages.
 * Mirrors the footer inside LandingPage.tsx for consistent branding.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] py-12 px-6 bg-[#060608] text-white">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-8 mb-10">
          <div className="max-w-xs">
            <div className="mb-3">
              <MushInLogo height={32} />
            </div>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Pakistan's first AI-powered influencer intelligence platform. Built to bring
              signal to a noisy market.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <div>
              <div className="text-white/60 font-semibold uppercase tracking-widest text-[10px] mb-3">
                Product
              </div>
              <div className="space-y-2">
                <Link to="/" className="block text-zinc-500 hover:text-white transition-colors">Features</Link>
                <Link to="/pricing" className="block text-zinc-500 hover:text-white transition-colors">Pricing</Link>
                <Link to="/blog" className="block text-zinc-500 hover:text-white transition-colors">Changelog</Link>
              </div>
            </div>

            <div>
              <div className="text-white/60 font-semibold uppercase tracking-widest text-[10px] mb-3">
                Company
              </div>
              <div className="space-y-2">
                <Link to="/" className="block text-zinc-500 hover:text-white transition-colors">About</Link>
                <Link to="/blog"  className="block text-zinc-500 hover:text-white transition-colors">Blog</Link>
                <span className="block text-zinc-500 cursor-default">Careers</span>
                <span className="block text-zinc-500 cursor-default">Press</span>
              </div>
            </div>

            <div>
              <div className="text-white/60 font-semibold uppercase tracking-widest text-[10px] mb-3">
                Legal
              </div>
              <div className="space-y-2">
                <Link to="/privacy" className="block text-zinc-500 hover:text-white transition-colors">Privacy</Link>
                <Link to="/terms"   className="block text-zinc-500 hover:text-white transition-colors">Terms</Link>
                <Link to="/cookies" className="block text-zinc-500 hover:text-white transition-colors">Cookies</Link>
                <Link to="/refunds" className="block text-zinc-500 hover:text-white transition-colors">Refund Policy</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-zinc-600 text-xs">© 2026 Mushin. All rights reserved. Made in Pakistan 🇵🇰</div>
          <div className="flex items-center gap-4">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Instagram className="w-4 h-4 text-zinc-600 hover:text-white transition-colors cursor-pointer" />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <Youtube className="w-4 h-4 text-zinc-600 hover:text-white transition-colors cursor-pointer" />
            </a>
            <a href="https://mushin-syq3.vercel.app" target="_blank" rel="noopener noreferrer" aria-label="Website">
              <Globe className="w-4 h-4 text-zinc-600 hover:text-white transition-colors cursor-pointer" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
