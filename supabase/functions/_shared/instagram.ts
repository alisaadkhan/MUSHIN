/**
 * _shared/instagram.ts
 * Instagram-specific data extraction.
 */

export function extractInstagramFollowers(text: string): number | null {
  const patterns = [
    /[·•]\s*(\d[\d,.]*)\s*([kKmMbB])?\s*(followers?)/i,
    /(\d[\d,.]*)\s*([kKmMbB])?\s*(followers?)/i,
    /followers?\s*:?\s*(\d[\d,.]*)\s*([kKmMbB])?/i,
  ];

  for (const patt of patterns) {
    const m = text.match(patt);
    if (!m) continue;
    
    let numStr = m[1];
    let suffix = m[2] || "";
    
    // Check if the pattern matched (followers: count)
    if (patt.source.startsWith("followers")) {
        numStr = m[1];
        suffix = m[2] || "";
    }

    if (!numStr) continue;
    let num = parseFloat(numStr.replace(/,/g, ""));
    if (isNaN(num)) continue;

    const s = suffix.toLowerCase();
    if (s === 'k') num *= 1000;
    if (s === 'm') num *= 1000000;
    if (s === 'b') num *= 1000000000;
    
    return Math.round(num);
  }
  return null;
}

export function extractInstagramEngagement(text: string): number | null {
  const m = text.match(/(\d[\d.]*)%\s*engagement/i);
  return m ? parseFloat(m[1]) : null;
}
