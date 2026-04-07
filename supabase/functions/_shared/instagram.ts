/**
 * _shared/instagram.ts
 * Instagram-specific data extraction.
 *
 * Instagram Serper snippets look like:
 *   "125K Followers, 420 Following, 1,890 Posts"
 *   "2.3M followers · 620 following · 4,100 posts"
 *   "Followers: 125,000"
 */

/**
 * Extract Instagram follower count from a snippet/title string.
 * Priority order: explicit "followers" label → fallback to first large number.
 */
export function extractInstagramFollowers(text: string): number | null {
  const patterns = [
    // "125K Followers" | "2.3M Followers" | "125,000 followers"
    /(\d[\d,.]*)[\s]*([kKmMbB])?\s+followers?\b/i,
    // "followers: 125K" | "followers · 2.3M"
    /followers?\s*[:\·\s]\s*(\d[\d,.]*)[\s]*([kKmMbB])?/i,
    // Bullet-separated: "• 125K followers"
    /[·•\|]\s*(\d[\d,.]*)[\s]*([kKmMbB])?\s+followers?\b/i,
  ];

  for (const patt of patterns) {
    const m = text.match(patt);
    if (!m) continue;

    // Which capture group has the number depends on pattern order
    const numStr = m[1];
    const suffix = m[2] || "";

    if (!numStr) continue;
    let num = parseFloat(numStr.replace(/,/g, ""));
    if (isNaN(num) || num <= 0) continue;

    const s = suffix.toLowerCase();
    if (s === "k") num *= 1_000;
    else if (s === "m") num *= 1_000_000;
    else if (s === "b") num *= 1_000_000_000;

    // Sanity: Instagram followers realistically < 500M
    if (num > 500_000_000) continue;

    return Math.round(num);
  }
  return null;
}

/**
 * Extract engagement rate from an Instagram snippet.
 * Serper/enrichment data may include explicit "X% engagement".
 */
export function extractInstagramEngagement(text: string): number | null {
  const m = text.match(/(\d[\d.]*)%\s*(?:engagement\s*rate?|engagement\b|er\b)/i);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Extract Instagram profile image URL from raw HTML.
 * Looks for og:image or profile picture meta tags.
 */
export function extractInstagramProfileImage(html: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
    ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
  if (ogMatch?.[1]) return ogMatch[1];

  // Twitter card fallback
  const twMatch = html.match(/<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/i);
  if (twMatch?.[1]) return twMatch[1];

  return null;
}
