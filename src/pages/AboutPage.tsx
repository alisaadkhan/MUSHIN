import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Shield, Zap, Layers } from 'lucide-react';

const LiveBackground = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#050505] pointer-events-none">
      {/* Moving Grid */}
      <div 
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #3f3f46 1px, transparent 1px),
            linear-gradient(to bottom, #3f3f46 1px, transparent 1px)
          `,
          backgroundSize: '4rem 4rem',
          maskImage: 'radial-gradient(ellipse 60% 60% at 50% 0%, #000 70%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 0%, #000 70%, transparent 100%)',
        }}
      />
      {/* Animated Light Paths */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full">
        <div className="absolute top-0 left-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-zinc-500 to-transparent opacity-20 animate-pulse" />
        <div className="absolute top-0 right-[20%] w-[1px] h-full bg-gradient-to-b from-transparent via-zinc-500 to-transparent opacity-20 animate-pulse delay-150" />
      </div>
    </div>
  );
};

const NavBar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-900 bg-[#050505]/80 backdrop-blur-md">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-zinc-100 rounded-sm" />
        <span className="text-zinc-100 font-semibold tracking-tight">Platform</span>
      </div>
      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
        <a href="#features" className="hover:text-zinc-100 transition-colors">Features</a>
        <a href="#metrics" className="hover:text-zinc-100 transition-colors">Metrics</a>
        <a href="#pricing" className="hover:text-zinc-100 transition-colors">Pricing</a>
      </div>
      <div className="flex items-center gap-4">
        <Link to="/auth" className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors">
          Sign In
        </Link>
        <Button className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300 rounded-md text-sm font-medium h-9 px-4">
          Get Started
        </Button>
      </div>
    </div>
  </nav>
);

const Hero = () => {
  return (
    <section className="relative pt-40 pb-20 px-6 z-10">
      <div className="max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 mb-8">
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-zinc-300">System v2.0 is live</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-zinc-100 mb-8 leading-[1.1]">
          Engineered for <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-500">
            Precision Performance.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
          Bypass traditional analytics. Deploy structured workflows, monitor real-time data ingestion, and execute commands instantly without interface latency.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button className="w-full sm:w-auto bg-zinc-100 text-zinc-950 hover:bg-zinc-300 rounded-md h-12 px-8 text-base font-medium">
            Deploy Workflow
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button variant="outline" className="w-full sm:w-auto border-zinc-800 bg-transparent text-zinc-100 hover:bg-zinc-900 rounded-md h-12 px-8 text-base font-medium">
            View Documentation
          </Button>
        </div>
      </div>
      
      {/* Interface Mockup */}
      <div className="mt-20 max-w-6xl mx-auto">
        <div className="relative rounded-lg border border-zinc-800 bg-[#0a0a0a] shadow-[0_0_60px_-15px_rgba(255,255,255,0.1)] overflow-hidden">
          <div className="h-10 border-b border-zinc-800 flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-zinc-800" />
            <div className="w-3 h-3 rounded-full bg-zinc-800" />
            <div className="w-3 h-3 rounded-full bg-zinc-800" />
          </div>
          <div className="aspect-[16/9] w-full bg-[#050505] p-8 flex items-center justify-center relative overflow-hidden">
            {/* Mockup Grid Data Representation */}
            <div className="w-full h-full grid grid-cols-3 gap-4">
              <div className="col-span-2 border border-zinc-800 rounded bg-[#0a0a0a]" />
              <div className="col-span-1 grid grid-rows-2 gap-4">
                <div className="border border-zinc-800 rounded bg-[#0a0a0a]" />
                <div className="border border-zinc-800 rounded bg-[#0a0a0a]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const BentoFeatures = () => {
  const features = [
    {
      title: "Real-Time Telemetry",
      description: "Stream data with sub-millisecond latency. Zero buffering.",
      icon: <Zap className="w-5 h-5 text-zinc-100" />,
      className: "col-span-1 md:col-span-2 row-span-1",
    },
    {
      title: "Immutable Security",
      description: "End-to-end encryption with hardware-level isolation.",
      icon: <Shield className="w-5 h-5 text-zinc-100" />,
      className: "col-span-1 md:col-span-1 row-span-2",
    },
    {
      title: "Advanced Analytics",
      description: "Query multi-dimensional datasets instantaneously.",
      icon: <BarChart3 className="w-5 h-5 text-zinc-100" />,
      className: "col-span-1 md:col-span-1 row-span-1",
    },
    {
      title: "Modular Architecture",
      description: "Scale components independently based on load requirements.",
      icon: <Layers className="w-5 h-5 text-zinc-100" />,
      className: "col-span-1 md:col-span-1 row-span-1",
    }
  ];

  return (
    <section id="features" className="py-24 px-6 relative z-10">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-100 mb-12">System Architecture</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[200px]">
          {features.map((feature, i) => (
            <div 
              key={i} 
              className={`group relative p-8 rounded-lg border border-zinc-800 bg-[#0a0a0a] hover:bg-zinc-900/50 transition-colors overflow-hidden ${feature.className}`}
            >
              <div className="mb-4 bg-zinc-900 w-10 h-10 rounded flex items-center justify-center border border-zinc-800">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-400 font-light">{feature.description}</p>
              
              {/* Hover highlight line */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] font-sans selection:bg-zinc-800 selection:text-zinc-100">
      <LiveBackground />
      <NavBar />
      <main className="relative z-10">
        <Hero />
        <BentoFeatures />
      </main>
      
      <footer className="border-t border-zinc-900 bg-[#050505] py-12 px-6 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <p>© 2026 Platform. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-zinc-300">Privacy</Link>
            <Link to="/terms" className="hover:text-zinc-300">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}