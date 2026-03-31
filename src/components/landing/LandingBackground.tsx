import React, { useRef, useEffect } from 'react';

/* --- Star Field -------------------------------------------------------------- */
export const StarField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const COLORS = ['#ffffff', '#a78bfa', '#c084fc', '#f0abfc'];
    const stars = Array.from({ length: 90 }, (_, i) => ({
      x: (i * 137.508 + 11) % 100,
      y: (i * 97.323 + 7) % 100,
      r: i % 3 === 0 ? 1.2 : i % 3 === 1 ? 0.75 : 0.45,
      color: COLORS[i % COLORS.length],
      base: 0.15 + (i % 5) * 0.08,
      phase: (i % 13) * 0.48,
      speed: 2.5 + (i % 7) * 0.65,
    }));

    let raf: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const opacity = s.base + Math.sin(t / (s.speed * 1000) + s.phase) * s.base * 0.9;
        ctx.beginPath();
        ctx.arc(s.x / 100 * canvas.width, s.y / 100 * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0, opacity);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 1, opacity: 0.85 }}
    />
  );
};

/* --- Grain Overlay ----------------------------------------------------------- */
export const GrainOverlay = () => (
  <svg className="pointer-events-none fixed inset-0 w-full h-full" style={{ zIndex: 2, opacity: 0.04 }} xmlns="http://www.w3.org/2000/svg">
    <filter id="grain-f"><feTurbulence type="fractalNoise" baseFrequency="0.80" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
    <rect width="100%" height="100%" filter="url(#grain-f)" />
  </svg>
);

/* --- Background Blobs --------------------------------------------------------- */
export const BgBlobs = () => (
  <div className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }}>
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full"
      style={{ background: 'radial-gradient(ellipse, rgba(88,28,135,0.09) 0%, transparent 68%)' }} />
    <div className="absolute bottom-0 right-0 w-[700px] h-[500px] rounded-full"
      style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.06) 0%, transparent 70%)' }} />
    <div className="absolute top-1/2 left-0 w-[500px] h-[400px] rounded-full"
      style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.04) 0%, transparent 70%)' }} />
  </div>
);

/* --- Scroll Glow -------------------------------------------------------------- */
export const ScrollGlow = () => {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const onScroll = () => {
      if (ref.current) ref.current.style.opacity = '1';
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { if (ref.current) ref.current.style.opacity = '0'; }, 700);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer.current); };
  }, []);
  return (
    <div ref={ref} className="pointer-events-none fixed inset-0 z-0" style={{ opacity: 0, transition: 'opacity 0.7s ease' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 35%, rgba(168,85,247,0.14) 0%, rgba(109,40,217,0.06) 45%, transparent 70%)' }} />
    </div>
  );
};

/* --- Mouse Glow -------------------------------------------------------------- */
export const MouseGlow = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mv = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.background = `radial-gradient(600px at ${e.clientX}px ${e.clientY}px, rgba(168,85,247,0.10) 0%, rgba(109,40,217,0.04) 40%, transparent 70%)`;
        ref.current.style.opacity = '1';
      }
    };
    const ml = () => { if (ref.current) ref.current.style.opacity = '0'; };
    window.addEventListener('mousemove', mv, { passive: true });
    document.documentElement.addEventListener('mouseleave', ml);
    return () => {
      window.removeEventListener('mousemove', mv);
      document.documentElement.removeEventListener('mouseleave', ml);
    };
  }, []);
  return (
    <div ref={ref} className="pointer-events-none fixed inset-0" style={{ zIndex: 1, opacity: 0, transition: 'opacity 0.4s ease' }} />
  );
};
