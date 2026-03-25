export type SearchResultLike = {
  platform?: string | null;
  username?: string | null;
  link?: string | null;
  extracted_followers?: number | null;
  engagement_rate?: number | null;
  _search_score?: number | null;
  _source?: string | null;
  _query_language?: string | null;
  snippet?: string | null;
  bio?: string | null;
  [key: string]: unknown;
};

export type FilterRange = [number, number];

export type ProgressiveFilterInput = {
  followerRange?: string | null;
  engagementRange?: string | null;
  contentLanguage?: "any" | "urdu" | "english" | "bilingual" | null;
  followerMap: Record<string, FilterRange>;
  engagementMap: Record<string, FilterRange>;
};

export type ProgressiveFallbackResult<T> = {
  tier:
    | "strict"
    | "relax_engagement"
    | "relax_followers"
    | "relax_followers_and_engagement"
    | "relax_all_filters";
  attempts: Array<{ tier: string; count: number }>;
  results: T[];
};

function normalizeUsername(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^@/, "");
}

function canonicalCreatorKey(item: SearchResultLike): string {
  const platform = (item.platform ?? "").toLowerCase();
  const uname = normalizeUsername(item.username);
  if (uname) return `${platform}:${uname}`;

  const link = (item.link ?? "").toLowerCase().trim();
  return `${platform}:link:${link}`;
}

export function dedupeCreatorResults<T extends SearchResultLike>(input: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of input) {
    const key = canonicalCreatorKey(item);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }

    const nextScore = Number(item._search_score ?? 0);
    const prevScore = Number(existing._search_score ?? 0);
    if (nextScore >= prevScore) {
      merged.set(key, {
        ...existing,
        ...item,
        _search_score: Math.max(prevScore, nextScore),
      });
    } else {
      merged.set(key, {
        ...item,
        ...existing,
        _search_score: Math.max(prevScore, nextScore),
      });
    }
  }

  return [...merged.values()];
}

function languageAllowed(item: SearchResultLike, contentLanguage: ProgressiveFilterInput["contentLanguage"]): boolean {
  if (!contentLanguage || contentLanguage === "any") return true;

  const URDU_CHARS = /[\u0600-\u06FF]/;
  const lang = String(item._query_language ?? "").toLowerCase();
  const snippet = String(item.snippet ?? item.bio ?? "");
  const hasUrdu = URDU_CHARS.test(snippet) || lang.includes("urdu") || lang.includes("roman");
  const hasEnglish = /[a-zA-Z]{3,}/.test(snippet);

  if (!hasUrdu && !hasEnglish) return true;
  if (contentLanguage === "urdu") return hasUrdu;
  if (contentLanguage === "english") return hasEnglish && !hasUrdu;
  return hasUrdu && hasEnglish;
}

function applyFilterPass<T extends SearchResultLike>(
  input: T[],
  args: ProgressiveFilterInput,
  mode: { followers: boolean; engagement: boolean; language: boolean },
): T[] {
  return input.filter((item) => {
    if (mode.followers && args.followerRange && args.followerRange !== "any") {
      const range = args.followerMap[args.followerRange];
      if (range) {
        const [min, max] = range;
        const value = item.extracted_followers;
        if (value == null || value < min || value > max) return false;
      }
    }

    if (mode.engagement && args.engagementRange && args.engagementRange !== "any") {
      const range = args.engagementMap[args.engagementRange];
      if (range) {
        const [min, max] = range;
        const value = item.engagement_rate;
        if (value == null || value < min || value > max) return false;
      }
    }

    if (mode.language && !languageAllowed(item, args.contentLanguage ?? "any")) {
      return false;
    }

    return true;
  });
}

export function runProgressiveResultFallback<T extends SearchResultLike>(
  input: T[],
  args: ProgressiveFilterInput,
): ProgressiveFallbackResult<T> {
  const attempts: Array<{ tier: string; count: number }> = [];

  const strict = applyFilterPass(input, args, { followers: true, engagement: true, language: true });
  attempts.push({ tier: "strict", count: strict.length });
  if (strict.length > 0) return { tier: "strict", attempts, results: strict };

  const relaxEngagement = applyFilterPass(input, args, { followers: true, engagement: false, language: true });
  attempts.push({ tier: "relax_engagement", count: relaxEngagement.length });
  if (relaxEngagement.length > 0) return { tier: "relax_engagement", attempts, results: relaxEngagement };

  const relaxFollowers = applyFilterPass(input, args, { followers: false, engagement: true, language: true });
  attempts.push({ tier: "relax_followers", count: relaxFollowers.length });
  if (relaxFollowers.length > 0) return { tier: "relax_followers", attempts, results: relaxFollowers };

  const relaxBoth = applyFilterPass(input, args, { followers: false, engagement: false, language: true });
  attempts.push({ tier: "relax_followers_and_engagement", count: relaxBoth.length });
  if (relaxBoth.length > 0) return { tier: "relax_followers_and_engagement", attempts, results: relaxBoth };

  attempts.push({ tier: "relax_all_filters", count: input.length });
  return { tier: "relax_all_filters", attempts, results: input };
}
