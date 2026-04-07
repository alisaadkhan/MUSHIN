/**
 * _shared/youtube.ts
 * YouTube-specific data extraction and API integration.
 *
 * YouTube Serper snippets look like:
 *   "MrBeast · 250M subscribers · 820 videos"
 *   "Subscribers: 1.2M"
 *   "2.5M subs · 150 videos"
 */

/**
 * Extract YouTube subscriber count from a snippet/title string.
 */
export function extractYouTubeSubscribers(text: string): number | null {
  const patterns = [
    // "250M subscribers" | "1.2K subscribers"  
    /(\d[\d,.]*)[\s]*([kKmMbB])?\s+subscribers?\b/i,
    // "subscribers: 1.2M" | "subscribers · 250M"
    /subscribers?\s*[:\·\s]\s*(\d[\d,.]*)[\s]*([kKmMbB])?/i,
    // Short form: "2.5M subs"
    /(\d[\d,.]*)[\s]*([kKmMbB])?\s+subs\b/i,
    /subs\s*[:\·\s]\s*(\d[\d,.]*)[\s]*([kKmMbB])?/i,
    // Bullet separated: "• 1.2M subscribers"
    /[·•\|]\s*(\d[\d,.]*)[\s]*([kKmMbB])?\s+subscribers?\b/i,
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

    // Sanity: YouTube subscribers < 300M
    if (num > 300_000_000) continue;

    return Math.round(num);
  }
  return null;
}

/**
 * Fetch subscriber count from YouTube Data API v3.
 * Supports both channel IDs (UC...) and handles (@username format).
 */
export async function fetchYouTubeSubscriberCount(
  username: string,
  apiKey: string,
): Promise<number | null> {
  if (!apiKey) return null;

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);

    // Determine whether this is a channel ID or a handle
    const cleanHandle = username.replace(/^@+/, "");
    const url = cleanHandle.startsWith("UC") && cleanHandle.length === 24
      ? `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${cleanHandle}&key=${apiKey}`
      : `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${cleanHandle}&key=${apiKey}`;

    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);

    if (!res.ok) {
      console.warn(`[youtube] API returned ${res.status} for ${cleanHandle}`);
      return null;
    }

    const data = await res.json();
    const count = data.items?.[0]?.statistics?.subscriberCount;
    if (count != null) {
      return parseInt(count, 10);
    }
  } catch (e) {
    console.warn("[youtube] API fetch failed:", (e as Error).message);
  }
  return null;
}

/**
 * Fetch YouTube channel thumbnail via oEmbed API.
 * Falls back gracefully to null rather than throwing.
 */
export async function extractYouTubeProfileImage(
  username: string,
): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 3000);

    const cleanHandle = username.replace(/^@+/, "");
    // oEmbed accepts both /channel/UC... and /@handle URLs
    const channelUrl = cleanHandle.startsWith("UC") && cleanHandle.length === 24
      ? `https://www.youtube.com/channel/${cleanHandle}`
      : `https://www.youtube.com/@${cleanHandle}`;

    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(channelUrl)}&format=json`,
      { signal: ctrl.signal },
    );
    clearTimeout(tid);

    if (res.ok) {
      const d = await res.json();
      return d.thumbnail_url || null;
    }
  } catch { /* noop — image is optional */ }
  return null;
}
