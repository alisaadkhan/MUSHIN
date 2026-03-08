/**
 * _shared/niche.ts
 *
 * Niche-inference module — isolated so that keyword lists, scoring
 * weights, and the `inferNiche` algorithm can be updated without
 * touching any edge-function handler.
 *
 * Consumers: search-influencers, (future) classify-niche
 */

export const NICHE_KEYWORDS: Record<string, [string, number][]> = {
  Food: [
    ["food", 3], ["recipe", 3], ["cooking", 3], ["cook", 2], ["chef", 3],
    ["eat", 2], ["eating", 2], ["foodie", 3], ["food vlog", 5], ["street food", 5],
    ["biryani", 5], ["nihari", 5], ["karahi", 5], ["desi food", 5], ["halal", 2],
    ["baking", 3], ["bakery", 3], ["restaurant review", 4], ["cafe", 2], ["cuisine", 3],
    ["mukbang", 4], ["food review", 5], ["food blogger", 5], ["food photography", 4],
    ["what i eat", 4], ["shawarma", 4], ["sehri", 4], ["iftar", 4], ["dawat", 4],
    ["khana", 4], ["pakwan", 4], ["taste test", 4],
  ],
  Fashion: [
    ["fashion", 3], ["style", 2], ["outfit", 3], ["ootd", 4], ["clothing", 2],
    ["wear", 2], ["dress", 2], ["hoodie", 2], ["streetwear", 4],
    ["mehndi", 3], ["shalwar", 4], ["kurta", 4], ["dupatta", 4], ["abaya", 4],
    ["model", 2], ["lookbook", 4], ["fashion blogger", 5], ["thrifting", 4],
    ["wardrobe", 3], ["aesthetic", 2], ["trend", 2], ["fashion week", 5],
  ],
  Beauty: [
    ["beauty", 3], ["makeup", 4], ["skincare", 4], ["cosmetics", 4],
    ["lipstick", 4], ["foundation", 3], ["eyeshadow", 4], ["glam", 3],
    ["glow", 2], ["beauty blogger", 5], ["contouring", 4], ["blush", 3],
    ["serum", 3], ["moisturizer", 3], ["facials", 3], ["haircare", 3],
    ["hair tutorial", 4], ["get ready with me", 5],
  ],
  Tech: [
    ["tech", 3], ["technology", 3], ["gadget", 4], ["software", 3],
    ["programming", 4], ["coding", 4], ["developer", 3], ["ai", 2],
    ["smartphone", 4], ["unboxing", 4], ["laptop", 4], ["iphone", 4],
    ["android", 3], ["startup", 2], ["tech review", 5], ["benchmark", 3],
  ],
  Fitness: [
    ["fitness", 4], ["gym", 4], ["workout", 4], ["exercise", 4],
    ["health", 2], ["muscle", 3], ["yoga", 4], ["running", 3],
    ["bodybuilding", 5], ["athlete", 3], ["trainer", 3], ["diet plan", 4],
    ["weight loss", 4], ["transformation", 3], ["calisthenics", 5], ["personal trainer", 5],
  ],
  Travel: [
    ["travel", 3], ["traveler", 4], ["adventure", 2], ["explore", 2],
    ["destination", 3], ["tourism", 3], ["trip", 2], ["wanderlust", 4],
    ["travel vlog", 5], ["tour guide", 4], ["backpacker", 4], ["vacation", 3],
    ["swat", 3], ["naran", 3], ["hunza", 4], ["lahore tour", 4], ["travel blogger", 5],
  ],
  Gaming: [
    ["gaming", 4], ["gamer", 4], ["esports", 4], ["twitch", 4],
    ["playstation", 4], ["xbox", 4], ["fortnite", 4], ["pubg", 5],
    ["gameplay", 4], ["free fire", 5], ["valorant", 4],
    ["let's play", 4], ["game review", 5], ["minecraft", 4],
  ],
  Music: [
    ["musician", 4], ["singer", 4], ["song", 3], ["rap", 4],
    ["album", 4], ["concert", 3], ["band", 3], ["bollywood", 4],
    ["coke studio", 5], ["ost", 4], ["cover song", 5], ["vocals", 3],
    ["naat", 5], ["nasheed", 5], ["music video", 5],
    ["recording artist", 5], ["music producer", 5], ["dj", 3], ["lyrics", 3],
  ],
  Education: [
    ["education", 4], ["learning", 3], ["teaching", 4], ["school", 2],
    ["university", 3], ["tutor", 4], ["lecture", 4], ["ielts", 5],
    ["o level", 4], ["a level", 4], ["skill development", 4],
    ["online course", 5], ["educational", 4],
  ],
  Comedy: [
    ["comedian", 5], ["comedy", 4], ["funny", 4], ["humor", 4], ["meme", 3],
    ["prank video", 5], ["sketch comedy", 5], ["stand-up", 5],
    ["laughter", 3], ["joke", 4], ["skit", 5], ["roast", 4], ["parody", 4],
    ["funny video", 5], ["make you laugh", 4], ["comedy channel", 5], ["standup", 5],
  ],
  Parenting: [
    ["mommy blogger", 5], ["parenting", 4], ["baby", 3], ["toddler", 4],
    ["mama", 3], ["mum", 3], ["bachay", 4], ["family life", 4], ["new mom", 5],
    ["pregnancy", 4], ["childcare", 5], ["motherhood", 5], ["newborn", 5],
  ],
  Entertainment: [
    ["lip sync", 4], ["dance challenge", 5], ["entertainment channel", 5],
    ["viral video", 4], ["trending video", 3], ["prank show", 5],
    ["reaction video", 5], ["variety show", 5], ["talk show", 5],
    ["interview show", 5], ["vlogger", 3], ["challenge", 3], ["fyp", 3],
  ],
  Lifestyle: [
    ["lifestyle", 4], ["luxury", 3], ["home decor", 4], ["interior design", 4],
    ["family", 2], ["relationship", 3], ["mindset", 3], ["motivation", 2],
    ["self care", 4], ["morning routine", 4], ["day in my life", 5],
    ["vlog", 3], ["lifestyle blogger", 5], ["productivity", 3],
  ],
  Finance: [
    ["finance", 4], ["money", 3], ["investment", 4], ["stock market", 5],
    ["crypto", 4], ["business", 2], ["entrepreneur", 4], ["saving", 3],
    ["passive income", 4], ["forex", 5], ["trading", 4], ["financial", 4],
  ],
  Health: [
    ["wellness", 4], ["mental health", 5], ["nutrition", 4], ["diet", 3],
    ["therapy", 4], ["doctor", 4], ["medicine", 3], ["herbal", 3],
    ["natural remedies", 4], ["hakeem", 4], ["healthcare", 4], ["medical", 3],
  ],
  Sports: [
    ["sports", 3], ["cricket", 5], ["football", 4], ["soccer", 4],
    ["tennis", 4], ["hockey", 4], ["psl", 5], ["ipl", 4], ["match", 3],
    ["kabaddi", 5], ["badminton", 4], ["wrestling", 3], ["sports analyst", 5],
  ],
  News: [
    ["news", 3], ["current affairs", 5], ["politics", 4], ["journalist", 5],
    ["anchor", 4], ["breaking news", 5], ["news update", 4], ["reporter", 4],
    ["geo news", 5], ["ary news", 5], ["analysis", 3], ["political analyst", 5],
  ],
  Photography: [
    ["photography", 4], ["photographer", 5], ["camera review", 5],
    ["portrait", 4], ["landscape photography", 5], ["photo editing", 4],
    ["lightroom", 5], ["photoshoot", 4], ["cinematography", 5],
  ],
  Art: [
    ["artist", 3], ["drawing", 4], ["painting", 4], ["sketch", 3],
    ["illustration", 4], ["calligraphy", 5], ["digital art", 5],
    ["graphic design", 4], ["animation", 4],
  ],
};

/** Priority order for tie-breaking when two niches score similarly. */
export const NICHE_PRIORITY = [
  "Food", "Tech", "Gaming", "Sports", "Music", "Comedy", "Education",
  "Fitness", "Beauty", "Fashion", "Travel", "Finance", "Parenting",
  "Entertainment", "Health", "News", "Photography", "Art", "Lifestyle",
];

const THRESHOLD = 3;
const DOMINANCE_GAP = 2;

/** Query-level keyword boosts: if the search query contains these words,
 *  boost the corresponding niche by +4 so it's promoted in ties. */
export const QUERY_BOOSTS: Array<[string[], string]> = [
  [["tech", "technology", "gadget", "software", "coding", "developer"], "Tech"],
  [["gaming", "gamer", "game", "esports", "pubg", "free fire", "valorant"], "Gaming"],
  [["food", "recipe", "cooking", "chef", "foodie", "restaurant"], "Food"],
  [["fashion", "style", "outfit", "ootd", "clothing"], "Fashion"],
  [["fitness", "gym", "workout", "bodybuilding"], "Fitness"],
  [["beauty", "makeup", "skincare"], "Beauty"],
  [["comedy", "funny", "humor", "comedian"], "Comedy"],
  [["travel", "traveler", "tourism", "adventure"], "Travel"],
  [["music", "singer", "musician", "rap", "song"], "Music"],
  [["sports", "cricket", "football", "psl"], "Sports"],
  [["parenting", "mommy", "baby", "toddler", "mother"], "Parenting"],
  [["entertainment", "viral", "trending", "challenge"], "Entertainment"],
];

/**
 * Infer the most likely niche for a social-media profile given the
 * Serper result title, snippet, and original search query.
 *
 * Returns the niche name and a 0–1 confidence score.
 */
export function inferNiche(
  title: string,
  snippet: string,
  query = "",
): { niche: string; confidence: number } {
  const titleText = (title || "").toLowerCase().repeat(2);
  const snippetText = (snippet || "").toLowerCase();
  const text = `${titleText} ${snippetText}`;
  const lowerQuery = (query || "").toLowerCase();

  const scores: Record<string, number> = {};

  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    let score = 0;
    for (const [kw, weight] of keywords) {
      if (text.includes(kw)) score += weight;
    }
    if (score > 0) scores[niche] = score;
  }

  for (const [queryKws, niche] of QUERY_BOOSTS) {
    if (queryKws.some(k => lowerQuery.includes(k))) {
      scores[niche] = (scores[niche] ?? 0) + 4;
    }
  }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  if (sorted.length === 0) return { niche: "General", confidence: 0.1 };

  const [topNiche, topScore] = sorted[0];
  const secondScore = sorted[1]?.[1] ?? 0;

  if (topScore < THRESHOLD) {
    return { niche: "General", confidence: Math.min(topScore / (THRESHOLD * 2), 0.4) };
  }

  const baseConf = Math.min(0.5 + (topScore * 0.05), 0.95);

  if (topScore - secondScore < DOMINANCE_GAP && secondScore >= THRESHOLD) {
    const tied = sorted
      .filter(([, s]) => topScore - s < DOMINANCE_GAP && s >= THRESHOLD)
      .map(([n]) => n);
    for (const n of NICHE_PRIORITY) {
      if (tied.includes(n)) return { niche: n, confidence: baseConf - 0.2 };
    }
  }

  return { niche: topNiche, confidence: baseConf };
}
