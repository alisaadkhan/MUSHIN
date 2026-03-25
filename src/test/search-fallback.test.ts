import { describe, expect, it } from "vitest";
import {
  dedupeCreatorResults,
  runProgressiveResultFallback,
} from "../../supabase/functions/_shared/search_result_fallback";

describe("search_result_fallback", () => {
  it("deduplicates by canonical platform+username and keeps highest score payload", () => {
    const input = [
      { platform: "instagram", username: "@CreatorOne", _search_score: 0.42, bio: "old" },
      { platform: "instagram", username: "creatorone", _search_score: 0.91, bio: "new" },
      { platform: "tiktok", username: "creatorone", _search_score: 0.63 },
    ];

    const out = dedupeCreatorResults(input as any);
    expect(out).toHaveLength(2);

    const ig = out.find((x: any) => x.platform === "instagram");
    expect(ig?._search_score).toBe(0.91);
    expect(ig?.bio).toBe("new");
  });

  it("uses strict tier when filtered results exist (default behavior regression guard)", () => {
    const input = [
      { extracted_followers: 25_000, engagement_rate: 4.5, _query_language: "english", snippet: "tech reviews" },
      { extracted_followers: 8_000, engagement_rate: 1.0, _query_language: "english", snippet: "tech" },
    ];

    const out = runProgressiveResultFallback(input as any, {
      followerRange: "10k-50k",
      engagementRange: "2-5",
      contentLanguage: "any",
      followerMap: { "10k-50k": [10_000, 50_000] },
      engagementMap: { "2-5": [2, 5] },
    });

    expect(out.tier).toBe("strict");
    expect(out.results).toHaveLength(1);
  });

  it("relaxes engagement filter when strict tier would return empty", () => {
    const input = [
      { extracted_followers: 25_000, engagement_rate: 1.2, _query_language: "english", snippet: "fitness coach" },
      { extracted_followers: 27_000, engagement_rate: 1.4, _query_language: "english", snippet: "fitness trainer" },
    ];

    const out = runProgressiveResultFallback(input as any, {
      followerRange: "10k-50k",
      engagementRange: "5-10",
      contentLanguage: "any",
      followerMap: { "10k-50k": [10_000, 50_000] },
      engagementMap: { "5-10": [5, 10] },
    });

    expect(out.tier).toBe("relax_engagement");
    expect(out.results).toHaveLength(2);
    expect(out.attempts[0]).toEqual({ tier: "strict", count: 0 });
  });
});
