/**
 * _shared/platform.ts
 *
 * Platform-utility module — URL parsing, username extraction, and
 * platform validation helpers used across multiple edge functions.
 *
 * Consumers: search-influencers, enrich-influencer
 */

/** Strict allowlist — any value not in this array must be rejected. */
export const ALLOWED_PLATFORMS = ["instagram", "tiktok", "youtube", "twitch"] as const;
export type SupportedPlatform = typeof ALLOWED_PLATFORMS[number];

/** Maps a platform name to its canonical domain. */
export const DOMAIN_MAP: Record<SupportedPlatform, string> = {
  instagram: "instagram.com",
  tiktok:    "tiktok.com",
  youtube:   "youtube.com",
  twitch:    "twitch.tv",
};

/**
 * Returns true if `value` is an accepted platform identifier.
 * Use this at the edge of every handler before storing or querying by platform.
 */
export function isValidPlatform(value: string): value is SupportedPlatform {
  return (ALLOWED_PLATFORMS as readonly string[]).includes(value);
}

/**
 * Extract a normalised `@handle` username from a social-media profile URL.
 *
 * Returns `null` when the URL is a non-profile path (e.g. a tag, playlist,
 * or aggregator page) so callers can skip those results.
 */
export function extractUsername(url: string, platform: string): string | null {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);

    if (platform === "youtube") {
      if (parts[0]?.startsWith("@")) return parts[0];
      if (["c", "channel", "user"].includes(parts[0])) return parts[1] || null;
      // Non-profile YouTube paths
      if (["watch", "playlist", "results", "feed", "shorts"].includes(parts[0])) return null;
      return parts[0] || null;
    }

    if (platform === "twitch") {
      // twitch.tv/{username} — first path segment is always the channel name
      const NON_PROFILE = ["directory", "moderator", "prime", "downloads", "videos",
        "clips", "schedule", "about", "search", "settings", "drops", "subscriptions"];
      if (!parts[0] || NON_PROFILE.includes(parts[0].toLowerCase())) return null;
      return `@${parts[0]}`;
    }

    const name = parts[0];
    if (
      !name ||
      ["p", "reel", "explore", "stories", "video", "tag", "search", "discover"].includes(name)
    ) {
      return null;
    }
    return name.startsWith("@") ? name : `@${name}`;
  } catch {
    return null;
  }
}

/**
 * Path segments that indicate a TikTok URL is NOT a user profile —
 * these should be filtered out before trying to extract a username.
 */
export const TIKTOK_GARBAGE_PATHS = [
  "tiktok.com/discover",
  "tiktok.com/tag/",
  "tiktok.com/music/",
  "tiktok.com/search",
  "tiktok.com/foryou",
  "tiktok.com/trending",
  "tiktok.com/explore",
  "vm.tiktok.com",
];

/**
 * Returns true when a TikTok URL looks like a real user profile
 * (starts with `@username` segment) rather than a category / discover page.
 */
export function isTikTokProfileUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (TIKTOK_GARBAGE_PATHS.some(p => lower.includes(p))) return false;
  try {
    const firstSegment = new URL(url).pathname.split("/").filter(Boolean)[0] ?? "";
    return firstSegment.startsWith("@");
  } catch {
    return false;
  }
}
/**
 * Clean platform noise and duplicate usernames from a creator's display name.
 */
export function cleanTitle(raw: string, username: string, platform: string): string {
  let cleaned = raw;
  // Strip platform suffix patterns like "• Instagram photos and videos", " - YouTube", etc.
  cleaned = cleaned.replace(/\s*[•·\-]\s*(Instagram|YouTube|TikTok|Twitch)\s*(photos|videos|channel|profile)?.*/gi, "");
  // Strip @username mentions already shown as sub-text
  cleaned = cleaned.replace(new RegExp(`\\s*\\(@?${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "gi"), "");
  // Strip trailing parentheses content that's just platform noise
  cleaned = cleaned.replace(/\s*\(.*?(?:instagram|youtube|tiktok|twitch).*?\)/gi, "");
  return cleaned.trim() || username;
}
