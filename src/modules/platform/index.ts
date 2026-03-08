/**
 * modules/platform/index.ts
 *
 * Platform adapter pattern for Mushin creator discovery.
 *
 * Currently active: Instagram, TikTok, YouTube.
 * Future: Twitch, Facebook, Twitter/X (prepared but not deployed).
 *
 * Architecture Note
 * ──────────────────
 * Each platform is described by a PlatformConfig that carries engagement
 * thresholds, domain, display name, and feature flags.  New platforms are
 * added to PLATFORM_CONFIGS when they become active; FUTURE_PLATFORMS tracks
 * planned additions without activating them.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupportedPlatform = "instagram" | "tiktok" | "youtube";
export type FuturePlatform    = "twitch" | "facebook" | "twitter_x";
export type AnyPlatform       = SupportedPlatform | FuturePlatform;

export interface EngagementThresholds {
  /** Engagement rate (%) that qualifies as excellent. */
  excellent: number;
  /** Engagement rate (%) that qualifies as good. */
  good: number;
  /** Engagement rate (%) below which quality is poor. */
  poor: number;
}

export interface PlatformConfig {
  id: SupportedPlatform;
  displayName: string;
  /** Root domain used to identify profile URLs (e.g. "instagram.com"). */
  domain: string;
  /** Engagement rate benchmarks for scoring quality. */
  engagementThresholds: EngagementThresholds;
  /** Whether creator enrichment (profile data fetch) is supported. */
  enrichmentSupported: boolean;
  /** Whether the platform is currently active in search. */
  active: boolean;
}

// ---------------------------------------------------------------------------
// Active platform configurations
// ---------------------------------------------------------------------------

export const PLATFORM_CONFIGS: Record<SupportedPlatform, PlatformConfig> = {
  instagram: {
    id:          "instagram",
    displayName: "Instagram",
    domain:      "instagram.com",
    engagementThresholds: { excellent: 5.0, good: 2.5, poor: 0.5 },
    enrichmentSupported: true,
    active:      true,
  },
  tiktok: {
    id:          "tiktok",
    displayName: "TikTok",
    domain:      "tiktok.com",
    engagementThresholds: { excellent: 8.0, good: 5.0, poor: 1.2 },
    enrichmentSupported: true,
    active:      true,
  },
  youtube: {
    id:          "youtube",
    displayName: "YouTube",
    domain:      "youtube.com",
    engagementThresholds: { excellent: 4.0, good: 2.5, poor: 0.5 },
    enrichmentSupported: true,
    active:      true,
  },
};

// ---------------------------------------------------------------------------
// Future platform registry (planned — not deployed)
// ---------------------------------------------------------------------------

export interface FuturePlatformEntry {
  displayName: string;
  domain: string;
  /** Set to true when implementation is ready to activate. */
  planned: boolean;
}

export const FUTURE_PLATFORMS: Record<FuturePlatform, FuturePlatformEntry> = {
  twitch: {
    displayName: "Twitch",
    domain:      "twitch.tv",
    planned:     true,
  },
  facebook: {
    displayName: "Facebook",
    domain:      "facebook.com",
    planned:     true,
  },
  twitter_x: {
    displayName: "X (Twitter)",
    domain:      "x.com",
    planned:     true,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the PlatformConfig for a supported platform, or null. */
export function getPlatformConfig(platform: string): PlatformConfig | null {
  return PLATFORM_CONFIGS[platform.toLowerCase() as SupportedPlatform] ?? null;
}

/** Returns true when the platform string is a currently active platform. */
export function isActivePlatform(platform: string): platform is SupportedPlatform {
  const config = getPlatformConfig(platform);
  return config?.active === true;
}

/** Returns the engagement thresholds for a platform with safe defaults. */
export function getEngagementThresholds(platform: string): EngagementThresholds {
  return getPlatformConfig(platform)?.engagementThresholds ?? { excellent: 5.0, good: 2.5, poor: 0.5 };
}

/** List all currently active platform IDs. */
export const ACTIVE_PLATFORMS: SupportedPlatform[] = Object.values(PLATFORM_CONFIGS)
  .filter((p) => p.active)
  .map((p) => p.id);
