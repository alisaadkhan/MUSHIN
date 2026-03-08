/**
 * src/modules/platforms/index.ts
 * Barrel export for all platform adapters
 */

// YouTube
export {
  YOUTUBE_ER_BENCHMARKS,
  classifyYouTubeTier,
  normaliseYouTubeMetrics,
} from "./youtube_adapter";
export type { YouTubeFollowerTier, YouTubeRawMetrics, YouTubeNormalisedMetrics } from "./youtube_adapter";

// Instagram
export {
  INSTAGRAM_ER_BENCHMARKS,
  classifyInstagramTier,
  normaliseInstagramMetrics,
} from "./instagram_adapter";
export type { InstagramFollowerTier, InstagramRawMetrics, InstagramNormalisedMetrics } from "./instagram_adapter";

// TikTok
export {
  TIKTOK_ER_BENCHMARKS,
  classifyTikTokTier,
  normaliseTikTokMetrics,
} from "./tiktok_adapter";
export type { TikTokFollowerTier, TikTokRawMetrics, TikTokNormalisedMetrics } from "./tiktok_adapter";

// Twitch (BETA)
export {
  TWITCH_ADAPTER_IS_BETA,
  TWITCH_ER_BENCHMARKS,
  classifyTwitchTier,
  normaliseTwitchMetrics,
} from "./twitch_adapter";
export type { TwitchFollowerTier, TwitchRawMetrics, TwitchNormalisedMetrics } from "./twitch_adapter";

// Facebook (BETA)
export {
  FACEBOOK_ADAPTER_IS_BETA,
  FACEBOOK_ER_BENCHMARKS,
  classifyFacebookTier,
  normaliseFacebookMetrics,
} from "./facebook_adapter";
export type { FacebookFollowerTier, FacebookRawMetrics, FacebookNormalisedMetrics } from "./facebook_adapter";

// X / Twitter (BETA — trend intelligence only)
export {
  TWITTER_ADAPTER_IS_BETA,
  TWITTER_ER_BENCHMARKS,
  classifyTwitterTier,
  normaliseTwitterMetrics,
} from "./twitter_adapter";
export type { TwitterFollowerTier, TwitterRawMetrics, TwitterNormalisedMetrics } from "./twitter_adapter";
