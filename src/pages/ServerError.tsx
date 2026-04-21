/**
 * ServerError.tsx  —  MUSHIN  ·  NEW PAGE (was missing)
 *
 * A production-grade 500 / server error boundary page.
 * Register this in your router for unexpected errors and service failures.
 *
 * Usage (React Router v6):
 *   <Route path="*" errorElement={<ServerError />} />
 *
 * Or call programmatically when catching a fatal error:
 *   navigate('/500') or render this component inside an ErrorBoundary.
 */

import React, { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Home, AlertTriangle } from 'lucide-react';
import { MushInIcon } from '@/components/ui/MushInLogo';

/* ─── Animated Ring ──────────────────────────────────────────────────────── */
const ErrorRing = () => (
  <div className="relative w-24 h-24 mx-auto mb-8">
    {/* Outer pulse ring */}
    <div
      className="absolute inset-0 rounded-full border border-red-500/20 animate-ping"
      style={{ animationDuration: '2.5s' }}
    />
    {/* Static ring */}
    <div className="absolute inset-0 rounded-full border border-red-500/30" />
    {/* Icon container */}
    <div className="absolute inset-2 rounded-full bg-red-500/[0.06] border border-red-500/20 flex items-center justify-center">
      <AlertTriangle className="w-8 h-8 text-red-400" />
    </div>
  </div>
);

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function ServerError() {
  const navigate = useNavigate();

  const handleRetry = useCallback(() => {
    // Hard refresh the current route — clears any stale state
    window.location.reload();
  }, []);

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return (
    <div
      className="min-h-screen bg-[#060608] text-white flex flex-col relative overflow-hidden"
      style={{ fontFamily: "'Syne', sans-serif" }}
    >
      {/* Background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 40%, rgba(127,29,29,0.09) 0%, transparent 70%)',
        }}
      />
      {/* Dot grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(239,68,68,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, black 40%, transparent 100%)',
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 border-b border-white/[0.06] py-4 px-6">
        <Link to="/" className="inline-flex items-center gap-2" aria-label="MUSHIN Home">
          <MushInIcon size={22} />
          <span className="font-bold tracking-[0.15em] text-sm">MUSHIN</span>
        </Link>
      </nav>

      {/* Main content */}
      <main
        role="main"
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center"
      >
        <ErrorRing />

        {/* Error Code */}
        <div
          className="text-[10rem] md:text-[14rem] font-black leading-none mb-4 select-none"
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(127,29,29,0.05) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
          aria-hidden="true"
        >
          500
        </div>

        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-3 text-white">
          Something Went Wrong
        </h1>
        <p className="text-zinc-400 text-base max-w-sm mx-auto mb-3 leading-relaxed">
          An unexpected error occurred on our end. Our team has been automatically notified and
          is investigating.
        </p>
        <p className="text-zinc-600 text-xs mb-10 max-w-xs mx-auto">
          This is not caused by anything you did. Please try again in a few moments.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-12">
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 transition-colors text-white font-bold text-sm px-8 py-3.5 rounded-full"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-all text-sm font-medium px-8 py-3.5 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-medium px-4 py-3.5"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </div>

        {/* Status card */}
        <div className="w-full max-w-sm rounded-xl border border-white/[0.07] bg-white/[0.02] px-6 py-5">
          <p className="text-zinc-500 text-xs leading-relaxed">
            If this problem persists, please contact us at{' '}
            <a
              href="mailto:support@mushin.com"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              support@mushin.com
            </a>{' '}
            and include the approximate time of the error.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center">
        <p className="text-zinc-700 text-xs">&copy; 2026 Mushin. Made in Pakistan.</p>
      </footer>
    </div>
  );
}
