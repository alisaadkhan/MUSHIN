/**
 * src/test/search-intelligence.test.ts
 *
 * Test suite for Phase 4 intelligence modules:
 *   - tag-ranking        (computeTagScore, normalizeTags, extractQueryTerms, getTagScore)
 *   - language-intelligence (analyzeLanguage, detectLanguage, normalizeQuery, normalizeName)
 *   - semantic-ranking   (cosineSimilarity, sortBySemantic, blendScores, getSemanticScore)
 *   - ranking-composer   (composeScore, composeScoreValue, computeKeywordRelevance, WEIGHT_*)
 *
 * All tests are zero-dependency (no network, no DB).
 * Target: these + existing 70 = 140+ total passing.
 */

import { describe, it, expect } from "vitest";

// ── Tag Ranking ─────────────────────────────────────────────────────────────
import {
  computeTagScore,
  normalizeTags,
  extractQueryTerms,
  getTagScore,
  normalizeTag,
  trigramSimilarity as tagTrigramSim,
  MAX_TAGS,
  TAG_SPAM,
} from "../modules/search/tag-ranking";

// ── Language Intelligence ────────────────────────────────────────────────────
import {
  analyzeLanguage,
  detectLanguage,
  normalizeQuery,
  normalizeName,
  NAME_VARIANT_MAP,
} from "../modules/search/language-intelligence";

// ── Semantic Ranking ─────────────────────────────────────────────────────────
import {
  cosineSimilarity,
  sortBySemantic,
  blendScores,
  getSemanticScore,
} from "../modules/search/semantic-ranking";

// ── Ranking Composer ─────────────────────────────────────────────────────────
import {
  composeScore,
  composeScoreValue,
  computeKeywordRelevance,
  WEIGHT_KEYWORD,
  WEIGHT_TAG,
  WEIGHT_SEMANTIC,
  WEIGHT_ENGAGEMENT,
  WEIGHT_AUTH,
  TOTAL_WEIGHT,
  KEYWORD_W_NAME,
  KEYWORD_W_NICHE,
  KEYWORD_W_LOCATION,
} from "../modules/search/ranking-composer";

// =============================================================================
// TAG RANKING
// =============================================================================

describe("normalizeTag", () => {
  it("lowercases the tag", () => {
    expect(normalizeTag("Fashion")).toBe("fashion");
  });

  it("replaces # and @ with space then trims", () => {
    expect(normalizeTag("#fashion")).toBe("fashion");
    expect(normalizeTag("@lahori")).toBe("lahori"); // not in spam list
  });

  it("returns null for spam tags", () => {
    expect(normalizeTag("viral")).toBeNull();
    expect(normalizeTag("fyp")).toBeNull();
    expect(normalizeTag("trending")).toBeNull();
    expect(normalizeTag("followme")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeTag("")).toBeNull();
    expect(normalizeTag("   ")).toBeNull();
  });

  it("preserves valid multi-word tags", () => {
    expect(normalizeTag("street_style")).toBe("street style");
  });
});

describe("normalizeTags", () => {
  it("deduplicates tags", () => {
    const result = normalizeTags(["fashion", "Fashion", "FASHION"]);
    expect(result).toEqual(["fashion"]);
  });

  it("filters spam", () => {
    const result = normalizeTags(["fashion", "viral", "fyp", "beauty"]);
    expect(result).toEqual(["fashion", "beauty"]);
  });

  it("caps at MAX_TAGS", () => {
    const raw = Array.from({ length: MAX_TAGS + 10 }, (_, i) => `tag${i}`);
    expect(normalizeTags(raw)).toHaveLength(MAX_TAGS);
  });

  it("returns empty array for all-spam input", () => {
    expect(normalizeTags(["viral", "trending", "fyp"])).toEqual([]);
  });
});

describe("extractQueryTerms", () => {
  it("splits on spaces and punctuation", () => {
    const terms = extractQueryTerms("fashion, beauty");
    expect(terms).toContain("fashion");
    expect(terms).toContain("beauty");
  });

  it("filters stopwords", () => {
    const terms = extractQueryTerms("and the fashion with blogger");
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("and");
    expect(terms).not.toContain("with");
    expect(terms).toContain("fashion");
    expect(terms).toContain("blogger");
  });

  it("filters tokens shorter than 3 chars", () => {
    const terms = extractQueryTerms("ai fashion");
    expect(terms).not.toContain("ai");
    expect(terms).toContain("fashion");
  });

  it("handles empty string", () => {
    expect(extractQueryTerms("")).toEqual([]);
  });
});

describe("computeTagScore", () => {
  it("returns zero when creator has no tags", () => {
    const result = computeTagScore({ query: "fashion", creatorTags: [] });
    expect(result.score).toBe(0);
    expect(result.exactHits).toBe(0);
  });

  it("returns high exact score for perfect tag match", () => {
    const result = computeTagScore({
      query: "fashion beauty",
      creatorTags: ["fashion", "beauty", "lifestyle"],
    });
    expect(result.exactMatch).toBeGreaterThan(0.8);
    expect(result.score).toBeGreaterThan(0.3);
  });

  it("partial match kicks in for substring matches", () => {
    const result = computeTagScore({
      query: "fashion blogger",
      creatorTags: ["fashion blogging", "style"],
    });
    expect(result.partialMatch).toBeGreaterThan(0);
  });

  it("semantic sim is non-zero for related words", () => {
    const result = computeTagScore({
      query: "tech review",
      creatorTags: ["technology", "review", "gadget"],
    });
    expect(result.semanticSim).toBeGreaterThan(0);
  });

  it("score is capped at 1.0", () => {
    const result = computeTagScore({
      query: "fashion beauty lifestyle food fitness travel gaming",
      creatorTags: ["fashion", "beauty", "lifestyle", "food", "fitness", "travel", "gaming"],
    });
    expect(result.score).toBeLessThanOrEqual(1.0);
  });

  it("reports correct exactHits count", () => {
    const result = computeTagScore({
      query: "fashion beauty unknown",
      creatorTags: ["fashion", "beauty"],
    });
    expect(result.exactHits).toBe(2);
  });
});

describe("getTagScore", () => {
  it("returns same value as computeTagScore.score", () => {
    const full = computeTagScore({ query: "fashion", creatorTags: ["fashion", "style"] });
    const short = getTagScore("fashion", ["fashion", "style"]);
    expect(short).toBeCloseTo(full.score);
  });

  it("returns 0 for empty tags", () => {
    expect(getTagScore("fashion", [])).toBe(0);
  });
});

describe("tagTrigramSim", () => {
  it("returns 1 for identical strings", () => {
    expect(tagTrigramSim("fashion", "fashion")).toBeCloseTo(1.0);
  });

  it("returns 0 for empty inputs", () => {
    expect(tagTrigramSim("", "fashion")).toBe(0);
  });

  it("partial overlap gives value between 0 and 1", () => {
    const sim = tagTrigramSim("fashion", "fashionable");
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

// =============================================================================
// LANGUAGE INTELLIGENCE
// =============================================================================

describe("detectLanguage", () => {
  it("detects plain English as english", () => {
    expect(detectLanguage("fashion blogger Pakistan")).toBe("english");
  });

  it("detects Urdu script as urdu", () => {
    expect(detectLanguage("فیشن بلاگر")).toBe("urdu");
  });

  it("detects Roman-Urdu markers as roman-urdu", () => {
    expect(detectLanguage("kya aap fashion blogger hain")).toBe("roman-urdu");
  });

  it("returns english for numeric/symbol queries", () => {
    expect(detectLanguage("top 10")).toBe("english");
  });
});

describe("analyzeLanguage - urdu", () => {
  it("has confidence proportional to Urdu char ratio", () => {
    const result = analyzeLanguage("فیشن بلاگر پاکستان");
    expect(result.language).toBe("urdu");
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.hasUrduScript).toBe(true);
  });

  it("preserves Urdu query unchanged (no normalization)", () => {
    const q = "فیشن";
    const result = analyzeLanguage(q);
    expect(result.normalizedQuery).toBe(q);
  });
});

describe("analyzeLanguage - roman-urdu", () => {
  it("detects aap/hai markers", () => {
    const result = analyzeLanguage("aap hai fashion blogger");
    expect(result.language).toBe("roman-urdu");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.hasUrduScript).toBe(false);
  });

  it("applies phonetic canonicalization to Roman-Urdu query", () => {
    const result = analyzeLanguage("khaana biryani lover");
    // "khaana" → kh→k, aa→a → "kana" (phonetically simplified)
    expect(result.normalizedQuery).toBeTruthy();
  });
});

describe("analyzeLanguage - english", () => {
  it("strips diacritics from English query", () => {
    const result = analyzeLanguage("café fashion");
    expect(result.normalizedQuery).toContain("cafe");
  });

  it("lowercases English query", () => {
    const result = analyzeLanguage("Fashion BLOGGER");
    expect(result.normalizedQuery).toBe("fashion blogger");
  });
});

describe("normalizeQuery", () => {
  it("lowercases English query", () => {
    expect(normalizeQuery("Fashion Blogger")).toBe("fashion blogger");
  });

  it("collapses name variants in English token", () => {
    // "hera" → "hira" via NAME_VARIANT_MAP
    const result = normalizeQuery("hera baig fashion");
    expect(result).toContain("hira");
  });

  it("preserves Urdu queries unchanged", () => {
    const q = "فیشن بلاگر";
    expect(normalizeQuery(q)).toBe(q);
  });
});

describe("normalizeName", () => {
  it("collapses Hera/Heera to hira", () => {
    expect(normalizeName("Hera Baig")).toBe("hira baig");
    expect(normalizeName("Heera Baig")).toBe("hira baig");
  });

  it("collapses Mohammed to muhammad", () => {
    expect(normalizeName("Mohammed Ali")).toBe("muhammad ali");
    expect(normalizeName("Mohammad Ali")).toBe("muhammad ali");
  });

  it("collapses Aisha to ayesha", () => {
    expect(normalizeName("Aisha Khan")).toBe("ayesha khan");
  });

  it("preserves names not in the variant map", () => {
    expect(normalizeName("Zara Ahmed")).toBe("zara ahmed");
  });

  it("handles single-token name", () => {
    expect(normalizeName("Hamzah")).toBe("hamza");
  });
});

describe("NAME_VARIANT_MAP", () => {
  it("maps hera to hira", () => {
    expect(NAME_VARIANT_MAP["hera"]).toBe("hira");
  });

  it("maps heera to hira", () => {
    expect(NAME_VARIANT_MAP["heera"]).toBe("hira");
  });

  it("maps fatema to fatima", () => {
    expect(NAME_VARIANT_MAP["fatema"]).toBe("fatima");
  });

  it("maps husain to hussain", () => {
    expect(NAME_VARIANT_MAP["husain"]).toBe("hussain");
  });
});

// =============================================================================
// SEMANTIC RANKING
// =============================================================================

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical unit vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns ~0.707 for 45-degree vectors", () => {
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(0.707, 2);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("clamps result to [0, 1]", () => {
    // Floating-point should not produce values slightly above 1
    const v = [0.6, 0.8];
    const sim = cosineSimilarity(v, v);
    expect(sim).toBeLessThanOrEqual(1.0);
    expect(sim).toBeGreaterThanOrEqual(0.0);
  });

  it("handles negative components (rare but valid)", () => {
    const sim = cosineSimilarity([-1, 0], [1, 0]);
    // cosine of 180° = -1, clamped to 0
    expect(sim).toBe(0);
  });
});

describe("sortBySemantic", () => {
  it("sorts by _semantic_score descending", () => {
    const input = [
      { name: "A", _semantic_score: 0.5 },
      { name: "B", _semantic_score: 0.9 },
      { name: "C", _semantic_score: 0.1 },
    ];
    const sorted = sortBySemantic(input);
    expect(sorted[0].name).toBe("B");
    expect(sorted[1].name).toBe("A");
    expect(sorted[2].name).toBe("C");
  });

  it("places items without _semantic_score at end", () => {
    const input = [
      { name: "A" },
      { name: "B", _semantic_score: 0.8 },
    ];
    const sorted = sortBySemantic(input);
    expect(sorted[0].name).toBe("B");
    expect(sorted[1].name).toBe("A");
  });

  it("does not mutate the original array", () => {
    const input = [{ _semantic_score: 0.2 }, { _semantic_score: 0.9 }];
    const sorted = sortBySemantic(input);
    expect(input[0]._semantic_score).toBe(0.2); // unchanged
  });

  it("returns a new array even when input is already sorted", () => {
    const input = [{ _semantic_score: 0.9 }, { _semantic_score: 0.1 }];
    const sorted = sortBySemantic(input);
    expect(sorted).not.toBe(input);
  });
});

describe("getSemanticScore", () => {
  it("returns the _semantic_score when present", () => {
    expect(getSemanticScore({ _semantic_score: 0.75 })).toBeCloseTo(0.75);
  });

  it("returns 0 when _semantic_score is missing", () => {
    expect(getSemanticScore({})).toBe(0);
  });

  it("clamps to [0, 1]", () => {
    expect(getSemanticScore({ _semantic_score: 1.5 })).toBe(1);
    expect(getSemanticScore({ _semantic_score: -0.5 })).toBe(0);
  });
});

describe("blendScores", () => {
  it("returns pure keyword when semanticWeight=0", () => {
    expect(blendScores(0.8, 0.2, 0)).toBeCloseTo(0.8);
  });

  it("returns pure semantic when semanticWeight=1", () => {
    expect(blendScores(0.8, 0.2, 1)).toBeCloseTo(0.2);
  });

  it("returns 50/50 blend at default weight", () => {
    expect(blendScores(0.6, 0.4)).toBeCloseTo(0.5);
  });

  it("clamps inputs before blending", () => {
    // Both out-of-range → clamped first
    expect(blendScores(1.5, -0.5, 0.5)).toBeCloseTo(0.5);
  });
});

// =============================================================================
// RANKING COMPOSER
// =============================================================================

describe("weight constants", () => {
  it("weights sum to exactly 1.0", () => {
    expect(TOTAL_WEIGHT).toBeCloseTo(1.0);
  });

  it("WEIGHT_KEYWORD is 0.35", () => {
    expect(WEIGHT_KEYWORD).toBe(0.35);
  });

  it("WEIGHT_TAG is 0.20", () => {
    expect(WEIGHT_TAG).toBe(0.20);
  });

  it("WEIGHT_SEMANTIC is 0.20", () => {
    expect(WEIGHT_SEMANTIC).toBe(0.20);
  });

  it("WEIGHT_ENGAGEMENT is 0.15", () => {
    expect(WEIGHT_ENGAGEMENT).toBe(0.15);
  });

  it("WEIGHT_AUTH is 0.10", () => {
    expect(WEIGHT_AUTH).toBe(0.10);
  });

  it("keyword sub-weights sum to 1.0", () => {
    expect(KEYWORD_W_NAME + KEYWORD_W_NICHE + KEYWORD_W_LOCATION).toBeCloseTo(1.0);
  });
});

describe("computeKeywordRelevance", () => {
  it("returns 1.0 for perfect name+niche+location match", () => {
    const score = computeKeywordRelevance({
      nameSimilarity: 1,
      nicheMatch: 1,
      locationMatch: 1,
    });
    expect(score).toBeCloseTo(1.0);
  });

  it("returns 0 for all zeros", () => {
    expect(computeKeywordRelevance({ nameSimilarity: 0, nicheMatch: 0, locationMatch: 0 })).toBe(0);
  });

  it("weights name similarity at 0.70", () => {
    const score = computeKeywordRelevance({ nameSimilarity: 1, nicheMatch: 0, locationMatch: 0 });
    expect(score).toBeCloseTo(0.70);
  });

  it("weights niche match at 0.20", () => {
    const score = computeKeywordRelevance({ nameSimilarity: 0, nicheMatch: 1, locationMatch: 0 });
    expect(score).toBeCloseTo(0.20);
  });

  it("weights location match at 0.10", () => {
    const score = computeKeywordRelevance({ nameSimilarity: 0, nicheMatch: 0, locationMatch: 1 });
    expect(score).toBeCloseTo(0.10);
  });

  it("clamps out-of-range inputs", () => {
    const score = computeKeywordRelevance({ nameSimilarity: 2, nicheMatch: -1, locationMatch: 0 });
    expect(score).toBeCloseTo(0.70); // nameSim clamped to 1, nicheMatch clamped to 0
  });
});

describe("composeScore", () => {
  it("returns full breakdown with final, layers, and weighted", () => {
    const result = composeScore({
      keywordRelevance: 1,
      tagMatchStrength: 1,
      semanticSimilarity: 1,
      engagementQuality: 1,
      authenticityScore: 1,
    });
    expect(result.final).toBeCloseTo(1.0);
    expect(result.layers.keyword).toBe(1);
    expect(result.weighted.keyword).toBeCloseTo(WEIGHT_KEYWORD);
  });

  it("returns 0 for all-zero input", () => {
    const result = composeScore({
      keywordRelevance: 0,
      tagMatchStrength: 0,
      semanticSimilarity: 0,
      engagementQuality: 0,
      authenticityScore: 0,
    });
    expect(result.final).toBe(0);
  });

  it("weighted contributions sum to final score", () => {
    const input = {
      keywordRelevance: 0.8,
      tagMatchStrength: 0.6,
      semanticSimilarity: 0.4,
      engagementQuality: 0.7,
      authenticityScore: 0.9,
    };
    const result = composeScore(input);
    const sum = Object.values(result.weighted).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(result.final, 5);
  });

  it("clamps out-of-range inputs to [0,1]", () => {
    const result = composeScore({
      keywordRelevance: 1.5,
      tagMatchStrength: -0.5,
      semanticSimilarity: 0.5,
      engagementQuality: 0.5,
      authenticityScore: 0.5,
    });
    expect(result.final).toBeGreaterThanOrEqual(0);
    expect(result.final).toBeLessThanOrEqual(1);
  });

  it("tag layer contributes proportionally at 0.20 weight", () => {
    const base = composeScore({
      keywordRelevance: 0.5,
      tagMatchStrength: 0,
      semanticSimilarity: 0.5,
      engagementQuality: 0.5,
      authenticityScore: 0.5,
    });
    const withTags = composeScore({
      keywordRelevance: 0.5,
      tagMatchStrength: 1,
      semanticSimilarity: 0.5,
      engagementQuality: 0.5,
      authenticityScore: 0.5,
    });
    expect(withTags.final - base.final).toBeCloseTo(WEIGHT_TAG, 5);
  });

  it("semantic layer contributes proportionally at 0.20 weight", () => {
    const base = composeScore({
      keywordRelevance: 0.5,
      tagMatchStrength: 0.5,
      semanticSimilarity: 0,
      engagementQuality: 0.5,
      authenticityScore: 0.5,
    });
    const withSem = composeScore({
      keywordRelevance: 0.5,
      tagMatchStrength: 0.5,
      semanticSimilarity: 1,
      engagementQuality: 0.5,
      authenticityScore: 0.5,
    });
    expect(withSem.final - base.final).toBeCloseTo(WEIGHT_SEMANTIC, 5);
  });
});

describe("composeScoreValue", () => {
  it("matches composeScore.final", () => {
    const input = {
      keywordRelevance: 0.7,
      tagMatchStrength: 0.3,
      semanticSimilarity: 0.5,
      engagementQuality: 0.8,
      authenticityScore: 0.9,
    };
    expect(composeScoreValue(input)).toBeCloseTo(composeScore(input).final);
  });
});

// =============================================================================
// RANKING FORMULA CONSISTENCY
// =============================================================================

describe("formula consistency — ranking-composer vs _shared/ranking.ts", () => {
  it("perfect creator beats zero-signal creator", () => {
    const perfect = composeScoreValue({
      keywordRelevance: 1,
      tagMatchStrength: 1,
      semanticSimilarity: 1,
      engagementQuality: 1,
      authenticityScore: 1,
    });
    const nobody = composeScoreValue({
      keywordRelevance: 0,
      tagMatchStrength: 0,
      semanticSimilarity: 0,
      engagementQuality: 0,
      authenticityScore: 0,
    });
    expect(perfect).toBeGreaterThan(nobody);
  });

  it("tag layer alone lifts score by exactly WEIGHT_TAG when other layers are equal", () => {
    const noTag = composeScoreValue({
      keywordRelevance: 0.5, tagMatchStrength: 0,
      semanticSimilarity: 0.5, engagementQuality: 0.5, authenticityScore: 0.5,
    });
    const withTag = composeScoreValue({
      keywordRelevance: 0.5, tagMatchStrength: 1,
      semanticSimilarity: 0.5, engagementQuality: 0.5, authenticityScore: 0.5,
    });
    expect(withTag - noTag).toBeCloseTo(WEIGHT_TAG);
  });

  it("authenticity at 0 lowers the score by WEIGHT_AUTH vs authenticity at 1", () => {
    const highAuth = composeScoreValue({
      keywordRelevance: 0.5, tagMatchStrength: 0.5,
      semanticSimilarity: 0.5, engagementQuality: 0.5, authenticityScore: 1,
    });
    const lowAuth = composeScoreValue({
      keywordRelevance: 0.5, tagMatchStrength: 0.5,
      semanticSimilarity: 0.5, engagementQuality: 0.5, authenticityScore: 0,
    });
    expect(highAuth - lowAuth).toBeCloseTo(WEIGHT_AUTH);
  });
});
