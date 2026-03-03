// ─── MUSHIN Brand Components ─────────────────────────────────────────────────
// 無心 · Pure Clarity · No Mind
// Samurai philosophy: the state of total mental clarity — seeing reality as it is.
// For MUSHIN: cutting through fake followers with pure signal.

import React from "react";
import mushinIconUrl from "@/assets/mushin-icon-512.png";
import mushinLogoUrl from "@/assets/mushin-logo.svg";

// ─── Design Tokens ────────────────────────────────────────────────────────────
export const M = {
  bg: "#0a0a0a",
  surface: "rgba(255,255,255,0.03)",
  surfaceElevated: "#0d0d0d",
  surfaceHigh: "#111111",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(168,85,247,0.35)",
  purple: "#A855F7",
  purpleDeep: "#7C3AED",
  purpleDim: "rgba(168,85,247,0.12)",
  purpleGlow: "0 0 28px rgba(168,85,247,0.22)",
  text: "rgba(255,255,255,0.92)",
  muted: "rgba(255,255,255,0.38)",
  dimmer: "rgba(255,255,255,0.15)",
  green: "#22C55E",
  red: "#EF4444",
  blue: "#3B82F6",
  amber: "#F59E0B",
};

// ─── MUSHIN Logo ──────────────────────────────────────────────────────────────
// Official brand icon from Assets/mushin-icon-512.png
export function MushinLogo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={mushinIconUrl}
      width={size}
      height={size}
      className={className}
      alt="MUSHIN"
      draggable={false}
    />
  );
}

// ─── Wordmark ─────────────────────────────────────────────────────────────────
// Official full wordmark from Assets/mushin-logo.svg
export function MushinWordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const heights = { sm: 24, md: 32, lg: 48 };
  const h = heights[size];

  return (
    <img
      src={mushinLogoUrl}
      height={h}
      style={{ width: "auto" }}
      alt="MUSHIN"
      draggable={false}
    />
  );
}

// ─── Platform Icons ───────────────────────────────────────────────────────────
export function InstagramIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="30%" stopColor="#DD2A7B" />
          <stop offset="65%" stopColor="#8134AF" />
          <stop offset="100%" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#ig-grad)" strokeWidth="1.8" fill="none" />
      <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad)" strokeWidth="1.8" fill="none" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-grad)" />
    </svg>
  );
}

export function TikTokIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.22 8.22 0 0 0 4.8 1.54V6.78a4.85 4.85 0 0 1-1.03-.09z"
        fill="#69C9D0"
      />
    </svg>
  );
}

export function YouTubeIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000" />
      <path d="M10 8.5l5.5 3.5-5.5 3.5V8.5z" fill="white" />
    </svg>
  );
}

export function PlatformIcon({
  platform,
  size = 14,
  className = "",
}: {
  platform: string;
  size?: number;
  className?: string;
}) {
  const p = platform?.toLowerCase();
  if (p === "instagram") return <InstagramIcon size={size} className={className} />;
  if (p === "tiktok") return <TikTokIcon size={size} className={className} />;
  if (p === "youtube") return <YouTubeIcon size={size} className={className} />;
  return null;
}

// ─── Platform colour map ──────────────────────────────────────────────────────
export const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  tiktok: "#69C9D0",
  youtube: "#FF0000",
};

export const PLATFORM_BG: Record<string, string> = {
  instagram: "rgba(225,48,108,0.12)",
  tiktok: "rgba(105,201,208,0.12)",
  youtube: "rgba(255,0,0,0.12)",
};
