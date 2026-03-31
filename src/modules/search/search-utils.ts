export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  username: string;
  platform: string;
  displayUrl?: string;
  extracted_followers?: number;
  imageUrl?: string;
  niche?: string;
  city?: string;
  city_extracted?: string;
  engagement_rate?: number;
  engagement_is_estimated?: boolean;
  bio?: string;
  full_name?: string;
  contact_email?: string | null;
  social_links?: string[];
  _search_score?: number;
  niche_confidence?: number;
  is_enriched?: boolean;
  enrichment_status?: string;
  is_stale?: boolean;
  last_enriched_at?: string | null;
  enrichment_ttl_days?: number;
  engagement_source?: "real_eval" | "real_enriched" | "benchmark_estimate";
  engagement_benchmark_bucket?: string;
  _intent?: string;
  tags?: string[];
}

export function dedupeSearchResults(input: SearchResult[]): SearchResult[] {
  const merged = new Map<string, SearchResult>();
  for (const item of input) {
    const platform = (item.platform ?? "").toLowerCase();
    const username = (item.username ?? "").trim().toLowerCase().replace(/^@/, "");
    const link = (item.link ?? "").trim().toLowerCase();
    const key = username ? `${platform}:${username}` : `${platform}:link:${link}`;

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }

    const existingScore = Number(existing._search_score ?? 0);
    const incomingScore = Number(item._search_score ?? 0);
    if (incomingScore >= existingScore) {
      merged.set(key, { ...existing, ...item, _search_score: Math.max(existingScore, incomingScore) });
    } else {
      merged.set(key, { ...item, ...existing, _search_score: Math.max(existingScore, incomingScore) });
    }
  }
  return [...merged.values()];
}

export function buildCacheKey(q: string, platform: string | string[], city: string, range: string) {
  const pStr = Array.isArray(platform)
    ? [...platform].map(p => p.toLowerCase()).sort().join(",") || "instagram"
    : platform.toLowerCase();
  return `mushin_sr:${q.toLowerCase()}|${pStr}|${city}|${range}`;
}
