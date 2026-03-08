// Normalization — username and platform identifier normalisation utilities

/** Strip leading @ from a username (safe to call multiple times). */
export function normalizeUsername(raw: string): string {
  return raw.startsWith("@") ? raw.slice(1) : raw;
}

/** Add @ prefix for Instagram / TikTok cache lookups. */
export function cacheUsername(raw: string): string {
  return raw.startsWith("@") ? raw : `@${raw}`;
}

/** Build both variants so callers can use `.in("username", bothVariants(u))`. */
export function bothVariants(username: string): [string, string] {
  const clean = normalizeUsername(username);
  return [clean, `@${clean}`];
}
