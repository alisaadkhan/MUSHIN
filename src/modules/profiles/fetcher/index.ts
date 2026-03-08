// Fetcher — data access layer for influencer profiles
// Wraps useInfluencerProfile and normalises the username format mismatch
// between influencer_profiles (no @) and influencers_cache (with @).
export { useInfluencerProfile } from "@/hooks/useInfluencerProfile";
