// Cache — TTL constants and React Query configuration helpers.
//
// All cache timing decisions live here so they can be updated in one place.
// Components and hooks must import from this module rather than hard-coding
// staleTime / gcTime values inline.

// ---------------------------------------------------------------------------
// React Query cache windows
// ---------------------------------------------------------------------------

/**
 * Per-query-type React Query staleTime and gcTime values.
 *
 * staleTime: how long a cached result is considered fresh (no background refetch).
 * gcTime:    how long an unused result is kept in memory before garbage collection.
 *
 * Tuned to stay within the Supabase free-tier edge function invocation budget:
 *   500k invocations/month ÷ ~833 DAU ÷ 30 days ≈ 20 calls/session budget.
 */
export const CACHE_WINDOWS = {
  /** Search results — cache aggressively; search is the most expensive call. */
  searchResults: { staleTime: 5 * 60_000,       gcTime: 30 * 60_000       },
  /** Creator profile — enriched data changes slowly. */
  profile:       { staleTime: 10 * 60_000,      gcTime: 60 * 60_000       },
  /** AI insights — generated text rarely changes; very expensive to regenerate. */
  aiInsights:    { staleTime: 30 * 60_000,      gcTime: 2 * 60 * 60_000   },
  /** Lookalike results — pre-computed nightly; stable within a session. */
  lookalikes:    { staleTime: 30 * 60_000,      gcTime: 2 * 60 * 60_000   },
  /** Plan credits — short TTL because users care about seeing accurate balances. */
  planCredits:   { staleTime: 30_000,           gcTime: 5 * 60_000         },
} as const;

// ---------------------------------------------------------------------------
// Redis TTL constants
// ---------------------------------------------------------------------------

/** Redis search result cache TTL: 1 hour. */
export const REDIS_SEARCH_TTL_SECONDS = 3_600;

/** Redis AI insight cache TTL: 24 hours (rarely changes). */
export const REDIS_INSIGHT_TTL_SECONDS = 86_400;

// ---------------------------------------------------------------------------
// Cache key construction
// ---------------------------------------------------------------------------

/**
 * Build a Redis-safe, versioned search cache key from raw filter values.
 *
 * The v2 prefix allows a clean cache bust if the response shape changes.
 * All string values are lowercased and trimmed so equivalent queries map
 * to the same key regardless of browser capitalisation.
 *
 * Example:
 *   buildRedisCacheKey("fashion", "instagram", "Lahore", "100k+")
 *   → "search:v2:fashion:instagram:lahore:100k+"
 */
export function buildRedisCacheKey(
  query: string,
  platform: string,
  location: string,
  followerRange: string,
): string {
  const parts = [
    query.toLowerCase().trim(),
    platform.toLowerCase().trim(),
    (location ?? "").toLowerCase().trim() || "any",
    followerRange || "any",
  ];
  return `search:v2:${parts.join(":")}`;
}

/**
 * Build the React Query key array for a search query.
 *
 * Using a stable array format ensures React Query correctly identifies
 * cache hits when the same filters are applied in different components.
 */
export function buildQueryKey(
  query: string,
  platform: string,
  location?: string,
  followerRange?: string,
  page?: number,
): readonly unknown[] {
  return [
    "search",
    query.toLowerCase().trim(),
    platform,
    (location ?? "").toLowerCase().trim() || "any",
    followerRange ?? "any",
    page ?? 0,
  ] as const;
}
