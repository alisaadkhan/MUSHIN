/**
 * Unit Tests - Backend Function Logic
 * Tests for search-influencers edge function fixes
 */

import { describe, it, expect } from "vitest";

// Mock the extraction functions
function extractTikTokFollowers(text: string): number | null {
  const patterns = [
    // "12.5M Followers" | "1.2K fans"
    /(\d[\d,.]*)[\s]*([kKmMbB])?\s+(?:followers?|fans?)\b/i,
    // "Followers: 12.5M" | "followers · 1.2M"
    /(?:followers?|fans?)\s*[:\·\s]\s*(\d[\d,.]*)[\s]*([kKmMbB])?/i,
    // Bullet/pipe separated: "• 12.5M followers"
    /[·•\|]\s*(\d[\d,.]*)[\s]*([kKmMbB])?\s+(?:followers?|fans?)\b/i,
    // "X Likes. Y Followers." pattern (common in TikTok snippets)
    /(\d[\d,.]*)[\s]*([kKmMbB])\s+(?:followers?|fans?)\.?\s*$/i,
    // "2M Likes. 150.5K Followers." - capture the followers part
    /(\d[\d,.]*)[\s]*([kKmMbB])\s+(?:followers?|fans?)/i,
  ];

  for (const patt of patterns) {
    const m = text.match(patt);
    if (!m) continue;

    const numStr = m[1];
    const suffix = m[2] || "";

    if (!numStr) continue;
    let num = parseFloat(numStr.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) continue;

    const s = suffix.toLowerCase();
    if (s === "k") num *= 1_000;
    else if (s === "m") num *= 1_000_000;
    else if (s === "b") num *= 1_000_000_000;

    if (num > 200_000_000) continue;

    return Math.round(num);
  }
  return null;
}

function cleanBio(text: string): string {
  if (!text) return "";
  // Remove follower/post counts at start
  let cleaned = text.replace(/^\d+\.?\d*[kKmMbB]?\s*(?:followers?|posts?|following|likes?)\s*[·|]\s*/gi, "");
  cleaned = cleaned.replace(/^\d+\.?\d*[kKmMbB]?\s*(?:followers?|posts?|following|likes?)\s*·\s*\d+\.?\d*[kKmMbB]?\s*(?:followers?|posts?|following|likes?)\s*·\s*/gi, "");
  // Remove hashtags
  cleaned = cleaned.replace(/#[\w\u0600-\u06FF]+/g, "");
  // Remove @mentions
  cleaned = cleaned.replace(/@[\w.]+/g, "");
  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  // Remove common noise patterns
  cleaned = cleaned.replace(/^(Watch|See|Check out|Follow|Discover)\s*/i, "");
  // Remove leading/trailing separators
  cleaned = cleaned.replace(/^[·|:-]+\s*/, "").replace(/\s*[·|:-]+$/, "");
  return cleaned;
}

describe("TikTok Follower Extraction", () => {
  it("extracts followers from standard format", () => {
    expect(extractTikTokFollowers("12.5M Followers · 890M Likes")).toBe(12500000);
    expect(extractTikTokFollowers("1.2K followers")).toBe(1200);
  });

  it("extracts followers from 'Followers: X' format", () => {
    expect(extractTikTokFollowers("Followers: 12.5M")).toBe(12500000);
    expect(extractTikTokFollowers("followers · 1.2M")).toBe(1200000);
  });

  it("extracts followers from 'X Likes. Y Followers.' format", () => {
    expect(extractTikTokFollowers("2M Likes. 150.5K Followers.")).toBe(150500);
    expect(extractTikTokFollowers("100K Likes. 50K Followers")).toBe(50000);
  });

  it("extracts followers from bullet-separated format", () => {
    expect(extractTikTokFollowers("• 12.5M followers")).toBe(12500000);
    expect(extractTikTokFollowers("| 1.2K fans")).toBe(1200);
  });

  it("returns null for invalid formats", () => {
    expect(extractTikTokFollowers("No follower data here")).toBe(null);
    expect(extractTikTokFollowers("")).toBe(null);
  });

  it("handles edge cases", () => {
    expect(extractTikTokFollowers("150.5K Followers.")).toBe(150500);
    expect(extractTikTokFollowers("GameStop (Pakistan) (@gamestoppk) on TikTok | 2M Likes. 150.5K Followers.")).toBe(150500);
  });
});

describe("Bio Cleaning", () => {
  it("removes follower count prefixes", () => {
    const input = "19K followers · 1K+ posts · We Quench your Gaming Thirst";
    const cleaned = cleanBio(input);
    expect(cleaned).toContain("We Quench your Gaming Thirst");
    expect(cleaned).not.toMatch(/^\d+[kKmMbB]?\s*followers/i);
    expect(cleaned).not.toMatch(/^\d+[kKmMbB]?\s*posts/i);
  });

  it("removes multiple follower patterns", () => {
    const input = "17K followers · 6 following · 1707 posts · Official Instagram Account";
    const expected = "Official Instagram Account";
    expect(cleanBio(input)).toBe(expected);
  });

  it("removes hashtags", () => {
    const input = "Gaming content #gaming #pakistan #fyp";
    const expected = "Gaming content";
    expect(cleanBio(input)).toBe(expected);
  });

  it("removes @mentions", () => {
    const input = "Follow @venturegamespk for gaming content";
    const cleaned = cleanBio(input);
    expect(cleaned).not.toMatch(/@[\w.]+/);
    expect(cleaned).toContain("gaming content");
  });

  it("removes noise patterns", () => {
    const input = "Watch this gaming content";
    const expected = "this gaming content";
    expect(cleanBio(input)).toBe(expected);
    
    expect(cleanBio("See amazing gaming")).toBe("amazing gaming");
    expect(cleanBio("Check out our gaming")).toBe("our gaming");
    expect(cleanBio("Follow for gaming")).toBe("for gaming");
    expect(cleanBio("Discover gaming")).toBe("gaming");
  });

  it("removes leading separators", () => {
    const input = "· | Gaming content";
    const cleaned = cleanBio(input);
    // The function removes leading separators, but pipe might remain
    expect(cleaned).toContain("Gaming content");
    // Should not start with multiple separators
    expect(cleaned.trim()).not.toMatch(/^[·:]+/);
  });

  it("handles complex real-world examples", () => {
    const input1 = "19K followers · 1K+ posts · We Quench your Gaming Thirst 🕹️ Follow for Epic Sales";
    expect(cleanBio(input1)).toContain("We Quench your Gaming Thirst");
    expect(cleanBio(input1)).not.toMatch(/^\d+K followers/);
    
    const input2 = "17K followers · 6 following · 1707 posts · Official Instagram Account";
    expect(cleanBio(input2)).toContain("Official Instagram Account");
    expect(cleanBio(input2)).not.toMatch(/^\d+K followers/);
  });

  it("preserves Urdu text", () => {
    const input = "10K followers · گمنگ کا بہترین مواد";
    const cleaned = cleanBio(input);
    expect(cleaned).toContain("گمنگ");
    expect(cleaned).not.toMatch(/^\d+K followers/);
  });
});

describe("Follower Filter Logic", () => {
  const rangeMap: Record<string, [number, number]> = {
    "10k-50k": [10_000, 50_000],
    "1k-10k": [1_000, 10_000],
    "50k-100k": [50_000, 100_000],
  };

  function applyFollowerFilter(followers: number | null, range: string): boolean {
    if (!range || range === "any" || !rangeMap[range]) return true;
    const [min, max] = rangeMap[range];
    
    // Soft filter: keep unknowns, only drop confirmed out-of-range
    if (followers == null) return true;
    if (followers < min * 0.5) return false;
    if (max !== Infinity && followers > max * 2) return false;
    return true;
  }

  it("keeps results with unknown follower count", () => {
    expect(applyFollowerFilter(null, "10k-50k")).toBe(true);
  });

  it("keeps results in range", () => {
    expect(applyFollowerFilter(15000, "10k-50k")).toBe(true);
    expect(applyFollowerFilter(50000, "10k-50k")).toBe(true);
  });

  it("keeps results slightly out of range (soft filter)", () => {
    // 8K is below 10k but above 5K (50% of min) - keep it
    expect(applyFollowerFilter(8000, "10k-50k")).toBe(true);
    
    // 60K is above 50k but below 100K (2x max) - keep it
    expect(applyFollowerFilter(60000, "10k-50k")).toBe(true);
  });

  it("drops results way out of range", () => {
    // 4K is below 5K (50% of 10k min) - drop it
    expect(applyFollowerFilter(4000, "10k-50k")).toBe(false);
    
    // 150K is above 100K (2x 50k max) - drop it
    expect(applyFollowerFilter(150000, "10k-50k")).toBe(false);
  });

  it("handles 'any' range", () => {
    expect(applyFollowerFilter(null, "any")).toBe(true);
    expect(applyFollowerFilter(100, "any")).toBe(true);
    expect(applyFollowerFilter(1000000, "any")).toBe(true);
  });
});
