// Filters — type contracts and validation utilities for search filter parameters.
//
// This module owns the canonical SearchFilters interface used across the
// frontend search pipeline. All components and hooks that read or write
// filter state should import types from here.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Platform = "instagram" | "tiktok" | "youtube";

export type FollowerRange =
  | "any"
  | "1k-10k"
  | "10k-50k"
  | "50k-100k"
  | "100k-500k"
  | "100k+"
  | "500k+";

export interface SearchFilters {
  query: string;
  platform: Platform;
  /** Optional city filter — canonical name (e.g. "Lahore") or "All Pakistan". */
  location?: string;
  followerRange?: FollowerRange;
  /** Minimum engagement rate percentage (e.g. 2.5 = 2.5 %). */
  minEngagement?: number;
  /** Canonical niche (e.g. "Fashion", "Tech"). */
  niche?: string;
  /** 0-based pagination page index. */
  page?: number;
}

// ---------------------------------------------------------------------------
// Follower range map
// ---------------------------------------------------------------------------

/**
 * Named follower range → [min, max] bounds.
 * Infinity signals no upper cap (open-ended range).
 */
export const FOLLOWER_RANGE_MAP: Record<string, [number, number]> = {
  "1k-10k":    [1_000,    10_000],
  "10k-50k":   [10_000,   50_000],
  "50k-100k":  [50_000,  100_000],
  "100k-500k": [100_000, 500_000],
  "100k+":     [100_000, Infinity],
  "500k+":     [500_000, Infinity],
};

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

/**
 * Build a deterministic, URL-safe cache key from a SearchFilters object.
 *
 * The key is used as:
 *   - React Query queryKey component
 *   - Redis GET/SET key prefix
 *   - URL search param for bookmarkable filters
 *
 * Stability guarantee: same filter values → same key string, regardless of
 * property insertion order.  The key format is version-prefixed so a
 * schema change can bust all existing cache entries immediately.
 */
export function buildFilterHash(filters: SearchFilters): string {
  const normalized = JSON.stringify({
    q:   (filters.query   ?? "").toLowerCase().trim(),
    pl:  filters.platform,
    loc: (filters.location ?? "").toLowerCase().trim(),
    fr:  filters.followerRange ?? "any",
    eng: filters.minEngagement ?? 0,
    nic: (filters.niche ?? "").toLowerCase().trim(),
    pg:  filters.page ?? 0,
  });
  // btoa is available in all modern browsers and Deno.
  // Replace URL-unsafe base64 chars for use in URL params and Redis keys.
  return `v2:${btoa(normalized).replace(/[+/=]/g, (c) =>
    ({ "+": "-", "/": "_", "=": "" }[c] ?? c)
  )}`;
}

/**
 * Validate that a raw filter object has the minimum required fields.
 * Returns an array of error strings (empty = valid).
 */
export function validateFilters(filters: Partial<SearchFilters>): string[] {
  const errors: string[] = [];
  if (!filters.query || filters.query.trim().length < 2) {
    errors.push("Query must be at least 2 characters.");
  }
  if (!filters.platform || !["instagram", "tiktok", "youtube"].includes(filters.platform)) {
    errors.push("Platform must be instagram, tiktok, or youtube.");
  }
  return errors;
}
