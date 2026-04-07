/**
 * _shared/youtube.ts
 * YouTube-specific data extraction and API integration.
 */

export function extractYouTubeSubscribers(text: string): number | null {
  const patterns = [
    /(\d[\d,.]*)\s*([kKmMbB])?\s*(?:subscribers?|subs\b)/i,
    /(?:subscribers?|subs\b)\s*:?\s*(\d[\d,.]*)\s*([kKmMbB])?/i,
  ];

  for (const patt of patterns) {
    const m = text.match(patt);
    if (!m) continue;
    
    let numStr = m[1];
    let suffix = m[2] || "";

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

export async function fetchYouTubeSubscriberCount(username: string, apiKey: string): Promise<number | null> {
  if (!apiKey) return null;
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 3000);
    
    let url: string;
    if (username.startsWith("UC")) {
      url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${username}&key=${apiKey}`;
    } else {
      url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${username.replace("@", "")}&key=${apiKey}`;
    }

    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    
    if (res.ok) {
      const data = await res.json();
      if (data.items?.[0]?.statistics?.subscriberCount) {
        return parseInt(data.items[0].statistics.subscriberCount, 10);
      }
    }
  } catch (e) {
    console.error("[youtube] API fetch failed:", e);
  }
  return null;
}

export async function extractYouTubeProfileImage(username: string): Promise<string | null> {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 2000);
      const url = username.startsWith("UC") 
        ? `https://www.youtube.com/channel/${username}`
        : `https://www.youtube.com/@${username.replace("@", "")}`;
        
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${url}&format=json`,
        { signal: ctrl.signal }
      );
      clearTimeout(tid);
      if (res.ok) {
        const d = await res.json();
        return d.thumbnail_url || null;
      }
    } catch { /* noop */ }
    return null;
}
