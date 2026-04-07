/**
 * _shared/followers.ts
 *
 * Follower-count extraction module.
 *
 * Parses numeric follower / subscriber counts from free-text snippets
 * returned by Serper (Google search).  Supports English, Urdu, Arabic,
 * and Hindi numeral systems and unit words.
 *
 * Consumers: search-influencers
 */

/**
 * Attempt to parse a follower / subscriber count from `text`.
 * Returns the integer count or `null` if no recognisable pattern is found.
 */
export function extractFollowers(text: string): number | null {
  const patterns = [
    // ── Urdu/Persian million / thousand ────────────────────────────────────
    /([۰-۹0-9][۰-۹0-9,.]*)[\s]*(ملین|ملیون|میلیون)\b/i,
    /([۰-۹0-9][۰-۹0-9,.]*)[\s]*(ہزار)\b/i,
    // ── Arabic ─────────────────────────────────────────────────────────────
    /([٠-٩0-9][٠-٩0-9,.]*)[\s]*(مليون|ألف)\b/i,
    // ── Hindi ──────────────────────────────────────────────────────────────
    /([0-9][0-9,.]*)[\s]*(लाख|करोड़|हज़ार)\b/i,
    // ── English — snippet formats ───────────────────────────────────────────
    /[·•]\s*(\d[\d,.]*)\s*([kKmMbB](?:illion)?)?\s*(followers?|subs(?:cribers?)?)/i,
    /(\d[\d,.]*)\s*([kKmMbB](?:illion)?)?\s*(followers?|subs(?:cribers?)?)/i,
    /(followers?|subs(?:cribers?)?)\s*:?\s*(\d[\d,.]*)\s*([kKmMbB](?:illion)?)?/i,
    // ── Standalone K/M/B with follower context nearby ────────────────────
    /(\d[\d,.]*)\s*([kKmMbB])\b(?=.{0,30}(?:follower|subscriber|audience|fan))/i,
    /(?:(?:follower|subscriber|audience|fan)[s']?\s*:?\s*)(\d[\d,.]*)\s*([kKmMbB])?/i,
    // ── Numbers in parentheses with follower context ─────────────────────
    /\((\d[\d,.]*)\s*([kKmMbB])?\s*(?:follower|subscriber|sub|fan)/i,
    // ── "1.2M+" or "500K+" style ──────────────────────────────────────────
    /(\d[\d,.]*)\s*([kKmMbB])\+?\s*(?:followers?|subs?)/i,
    // ── Bare number with K/M/B near follower word (within 30 chars) ──────
    /(\d[\d,.]*)\s*([kKmMbB])\b.{0,30}(?:follower|subscriber|sub\b)/i,
    /(?:follower|subscriber|subs?)\b.{0,30}(\d[\d,.]*)\s*([kKmMbB])\b/i,
    // ── TikTok-specific formats ────────────────────────────────────────────
    /(\d[\d,.]*)\s*([kKmMbB])\s*(?:followers?|fans?|likes?)/i,
    /(?:(?:followers?|fans?|likes?)[s']?\s*:?\s*)(\d[\d,.]*)\s*([kKmMbB])?/i,
    /(\d[\d,.]*)\s*([kKmMbB])\+?\s*(?:followers?|fans?|likes?)/i,
  ];

  const REVERSED_PATTERN_INDEX = 6;

  for (let i = 0; i < patterns.length; i++) {
    const patt = patterns[i];
    const m = text.match(patt);
    if (!m) continue;

    let numStr: string, suffix: string;
    if (i === REVERSED_PATTERN_INDEX) {
      numStr = m[2];
      suffix = m[3] || "";
    } else {
      numStr = m[1];
      suffix = m[2] || "";
    }

    if (!numStr) continue;
    let num = parseFloat(numStr.replace(/,/g, ""));
    if (isNaN(num)) continue;

    const s = suffix.toLowerCase();
    const mult: Record<string, number> = {
      // English
      k: 1_000, m: 1_000_000, b: 1_000_000_000,
      // Urdu/Persian
      "ہزار": 1_000, "ملین": 1_000_000, "ملیون": 1_000_000, "میلیون": 1_000_000,
      // Arabic
      "ألف": 1_000, "مليون": 1_000_000,
      // Hindi
      "हज़ार": 1_000, "लाख": 100_000, "करोड़": 10_000_000,
    };

    if (mult[s]) num *= mult[s];
    return Math.round(num);
  }

  return null;
}
