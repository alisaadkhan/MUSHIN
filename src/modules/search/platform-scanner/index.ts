// Platform Scanner — per-platform query routing (Instagram / TikTok / YouTube)
// Delegates to the server-side search-influencers edge function;
// this module owns the client-side contract for those calls.
export type Platform = "instagram" | "tiktok" | "youtube";

export interface PlatformScanResult {
  username: string;
  platform: Platform;
  followers: number;
  engagement_rate: number;
  niche: string;
  city: string;
}
