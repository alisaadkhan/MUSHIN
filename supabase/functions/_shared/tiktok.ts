/**
 * _shared/tiktok.ts
 * TikTok-specific data extraction.
 *
 * TikTok Serper snippets typically look like:
 *   "12.5M Followers · 890M Likes · 320 Videos"
 *   "1.2M followers | 45.6M likes"
 *   "Followers: 1,200,000"
 */

/**
 * Extract TikTok follower count from a snippet/title string.
 * TikTok uses "Followers" and "Fans" interchangeably.
 */
export function extractTikTokFollowers(text: string): number | null {
  const patterns = [
    // "12.5M Followers" | "1.2K fans"
    /(\d[\d,.]*)[\s]*([kKmMbB])?\s+(?:followers?|fans?)\b/i,
    // "Followers: 12.5M" | "followers · 1.2M"
    /(?:followers?|fans?)\s*[:\·\s]\s*(\d[\d,.]*)[\s]*([kKmMbB])?/i,
    // Bullet/pipe separated: "• 12.5M followers"
    /[·•\|]\s*(\d[\d,.]*)[\s]*([kKmMbB])?\s+(?:followers?|fans?)\b/i,
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

    // Sanity: TikTok followers < 200M
    if (num > 200_000_000) continue;

    return Math.round(num);
  }
  return null;
}

/**
 * Extract engagement rate from a TikTok snippet.
 * Some enrichment providers include explicit engagement rate labels.
 */
export function extractTikTokEngagement(text: string): number | null {
  const m = text.match(/(\d[\d.]*)%\s*(?:engagement\s*rate?|engagement\b|err?\b)/i);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Extract TikTok profile image URL from raw HTML.
 */
export function extractTikTokProfileImage(html: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
  if (ogMatch?.[1]) return ogMatch[1];

  const twMatch = html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i);
  if (twMatch?.[1]) return twMatch[1];

  return null;
}
