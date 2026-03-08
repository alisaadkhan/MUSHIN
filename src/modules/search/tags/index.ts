/**
 * src/modules/search/tags/index.ts
 * Barrel export for tag classification + similarity
 */
export { extractTagsFromBio, extractTagsFromHashtags, buildCreatorTagProfile } from "./tag_classifier";
export { queryTagSimilarity, rankByTagSimilarity } from "./tag_similarity_engine";
