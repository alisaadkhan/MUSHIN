/**
 * deep-capture.spec.ts
 *
 * MUSHIN DEEP DATA CAPTURE — Full Result Examination Suite
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * What this does:
 *   For every search combination (platform × niche × city × follower range × keyword):
 *   1. Run the search, capture ALL visible card data (not just handles)
 *   2. Click through to each profile page, capture EVERY rendered field
 *   3. Record: followers, following, posts, engagement, bio, city, niche, IQ score,
 *      bot risk score, audience quality, data source, enrichment status, evaluation
 *      report (demographics, authenticity, brand safety, growth), content performance
 *   4. Save everything to deep-capture-results.json and a human-readable .md file
 *
 * Results file structure:
 *   {
 *     meta: { run_at, total_combos, total_profiles_visited, ... },
 *     combos: [
 *       {
 *         combo_id, filters, card_count, cards: [
 *           {
 *             // From search result card
 *             search_card: { username, platform, niche, city, bio, followers_display,
 *                           followers_raw, engagement_display, engagement_source,
 *                           iq_score, is_enriched, is_stale, profile_link, ... },
 *             // From profile page (if visited)
 *             profile_page: { full_name, followers, following, posts, engagement,
 *                            city, niche, overall_score, bio, data_source,
 *                            enrichment_status, audience_quality_score,
 *                            bot_probability, bot_risk_score, bot_tier,
 *                            evaluation: { overall_score, engagement_rating,
 *                              authenticity, brand_safety, demographics,
 *                              growth_assessment, niche_categories, ... },
 *                            follower_history_points,
 *                            content_performance: [...],
 *                            joined_year, ... }
 *           }
 *         ]
 *       }
 *     ]
 *   }
 *
 * Run:
 *   npm run test:e2e:capture
 *   PROFILE_DEPTH=3 COMBO_LIMIT=50 npm run test:e2e:capture
 *
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── Configuration ─────────────────────────────────────────────────────────────
const COMBO_LIMIT      = parseInt(process.env.COMBO_LIMIT    ?? "60",  10);
const PROFILE_DEPTH    = parseInt(process.env.PROFILE_DEPTH  ?? "3",   10); // max profiles to visit per combo
const SEARCH_TIMEOUT   = 30_000;
const PROFILE_TIMEOUT  = 45_000;
const INTER_ACTION_MS  = 800;
const OUT_DIR          = path.join(process.cwd(), "test-results");
const RUN_ID           = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

// ─── Domain Constants ──────────────────────────────────────────────────────────
const PLATFORMS = ["Instagram", "TikTok", "YouTube"] as const;

const NICHES = [
  "Fashion","Food","Beauty","Cricket","Tech","Fitness","Travel",
  "Gaming","Music","Education","Comedy","Lifestyle","Finance",
  "Health","Automotive","Photography","Art","Sports","News",
] as const;

const CITIES = [
  "All Pakistan","Karachi","Lahore","Islamabad","Rawalpindi",
  "Faisalabad","Multan","Peshawar","Quetta","Sialkot","Gujranwala",
] as const;

const FOLLOWER_RANGES = [
  { label: "Any size",            value: "any",        min: 0,       max: Infinity },
  { label: "Nano (1k–10k)",       value: "1k-10k",     min: 1000,    max: 10000    },
  { label: "Micro (10k–50k)",     value: "10k-50k",    min: 10000,   max: 50000    },
  { label: "Mid-tier (50k–100k)", value: "50k-100k",   min: 50000,   max: 100000   },
  { label: "Macro (100k–500k)",   value: "100k-500k",  min: 100000,  max: 500000   },
  { label: "Mega (500k+)",        value: "500k+",      min: 500000,  max: Infinity },
] as const;

const KEYWORDS = [
  "Pakistani influencer",
  "Karachi fashion blogger",
  "Lahore tech",
  "Islamabad fitness",
  "Pakistani food vlog",
  "Cricket analyst Pakistan",
  "Urdu comedy",
  "Pakistani beauty tips",
  "Gaming Pakistan",
  "high engagement beauty",
  "@nabeelzuberi",
  "k",            // very short (edge case)
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchCardData {
  position:             number;
  username:             string;
  full_name:            string | null;
  platform:             string | null;
  niche:                string | null;
  city:                 string | null;
  bio:                  string | null;
  followers_display:    string | null;
  followers_raw:        number | null;
  engagement_display:   string | null;
  engagement_source:    string | null;  // "REAL" | "STALE" | "BENCHMARK" | "EST" | null
  iq_score:             number | null;
  is_enriched:          boolean;
  is_stale:             boolean;
  profile_link:         string | null;
  avatar_type:          "image" | "initials" | null;
  has_verified_badge:   boolean;
}

interface ProfilePageData {
  visited:              boolean;
  visited_at:           string | null;
  error:                string | null;
  // Header
  full_name:            string | null;
  username:             string | null;
  platform:             string | null;
  niche:                string | null;
  city:                 string | null;
  joined_year:          string | null;
  bio:                  string | null;
  profile_link:         string | null;
  // Stats block
  followers:            string | null;
  following:            string | null;
  posts_count:          string | null;
  engagement_rate:      string | null;
  // Quality signals
  overall_score:        number | null;
  audience_quality_score: number | null;
  bot_probability_raw:  number | null;  // 0–100
  bot_risk_tier:        string | null;  // "Authentic" | "Low Risk" | etc.
  data_source_badge:    string | null;  // "YouTube Verified" | "Simulated Data" | "Data from Google" | null
  enrichment_status:    string | null;  // "failed" | "success" | null
  is_stale_badge:       boolean;
  // Follower growth
  follower_history_points: number;
  follower_history_first:  number | null;
  follower_history_last:   number | null;
  // Content performance table
  content_performance: Array<{
    type: string;
    posts: number;
    sponsored: number;
    organic: number;
  }>;
  // AI Evaluation (if present)
  evaluation_present:   boolean;
  evaluation: {
    overall_score:      number | null;
    // Engagement panel
    engagement_tier:    string | null;  // e.g. "Above Average"
    engagement_rate:    string | null;
    // Authenticity panel
    authenticity_score: string | null;
    authenticity_tier:  string | null;
    // Brand safety panel
    brand_safety_tier:  string | null;
    brand_safety_score: string | null;
    // Demographics
    age_range:          string | null;
    gender_split:       string | null;
    top_locations:      string[];
    // Growth assessment
    growth_pattern:     string | null;
    risk_flags:         string[];
    // Niche tags
    niche_categories:   string[];
    // Recommendations
    recommendations:    string[];
  };
  // Bot signals panel (detect-bot-entendre)
  bot_signals_panel: {
    present:            boolean;
    score:              number | null;
    tier:               string | null;
    signals_triggered:  number | null;
    total_signals:      number | null;
    confidence_tier:    string | null;
    top_signals:        string[];
  };
}

interface CapturedCard {
  search_card: SearchCardData;
  profile_page: ProfilePageData;
}

interface ComboResult {
  combo_id:    number;
  run_at:      string;
  filters: {
    platform:       string;
    niches:         string[];
    city:           string;
    follower_range: string;
    keyword:        string;
    combo_type:     string;
  };
  search_duration_ms:    number;
  card_count_rendered:   number;
  profiles_visited:      number;
  cards:                 CapturedCard[];
  console_errors:        string[];
  network_errors:        string[];
}

// ─── Combo Generator ──────────────────────────────────────────────────────────
function generateCombos(limit: number) {
  const combos: Array<{
    platform: string; niches: string[]; city: string;
    followerRange: string; keyword: string; type: string;
  }> = [];

  // Seeded shuffle
  function shuffle<T>(arr: T[], seed = 42): T[] {
    const a = [...arr]; let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(s) % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Primary grid: platform × niche × city (all with "any" range)
  for (const platform of PLATFORMS) {
    for (const niche of NICHES.slice(0, 8)) {
      for (const city of ["All Pakistan", "Karachi", "Lahore", "Islamabad"]) {
        combos.push({
          platform, niches: [niche], city,
          followerRange: "any",
          keyword: `${niche.toLowerCase()} ${city === "All Pakistan" ? "Pakistan" : city}`,
          type: "primary",
        });
      }
    }
  }

  // Follower range matrix: most common niche × each range
  for (const range of FOLLOWER_RANGES) {
    for (const platform of ["Instagram", "TikTok"] as const) {
      combos.push({
        platform, niches: ["Fashion"], city: "All Pakistan",
        followerRange: range.value,
        keyword: "Pakistani fashion influencer",
        type: "range-sweep",
      });
    }
  }

  // Multi-niche combos
  const multiNichePairs = [
    ["Fashion", "Beauty"], ["Tech", "Gaming"], ["Food", "Lifestyle"],
    ["Cricket", "Sports"], ["Fitness", "Health"], ["Comedy", "Entertainment"],
  ];
  for (const pair of multiNichePairs) {
    combos.push({
      platform: "Instagram", niches: pair, city: "All Pakistan",
      followerRange: "any", keyword: pair.join(" "),
      type: "multi-niche",
    });
  }

  // Keyword-only searches (no niche filter)
  for (const keyword of KEYWORDS) {
    combos.push({
      platform: "Instagram", niches: [], city: "All Pakistan",
      followerRange: "any", keyword, type: "keyword",
    });
  }

  // Edge cases
  const edgeCases = [
    { platform: "YouTube",   niches: ["Tech"],             city: "Islamabad",   followerRange: "100k-500k", keyword: "Pakistani tech YouTube",  type: "edge" },
    { platform: "TikTok",    niches: ["Beauty","Fashion"], city: "Karachi",     followerRange: "10k-50k",   keyword: "Karachi beauty",           type: "edge" },
    { platform: "YouTube",   niches: [],                   city: "Quetta",      followerRange: "any",       keyword: "Quetta influencer",        type: "edge" },
    { platform: "Instagram", niches: ["Finance"],          city: "Lahore",      followerRange: "50k-100k",  keyword: "Lahore finance",           type: "edge" },
    { platform: "TikTok",    niches: [],                   city: "All Pakistan", followerRange: "500k+",    keyword: "viral Pakistani",          type: "edge" },
    { platform: "Instagram", niches: [],                   city: "All Pakistan", followerRange: "any",      keyword: "@nonexistent99999",        type: "edge" },
  ];
  combos.push(...edgeCases);

  return shuffle(combos).slice(0, limit);
}

// ─── Empty profile skeleton (reused so we don't repeat the literal) ───────────
function emptyProfile(): ProfilePageData {
  return {
    visited: false, visited_at: null, error: null,
    full_name: null, username: null, platform: null, niche: null,
    city: null, joined_year: null, bio: null, profile_link: null,
    followers: null, following: null, posts_count: null, engagement_rate: null,
    overall_score: null, audience_quality_score: null,
    bot_probability_raw: null, bot_risk_tier: null,
    data_source_badge: null, enrichment_status: null, is_stale_badge: false,
    follower_history_points: 0, follower_history_first: null, follower_history_last: null,
    content_performance: [],
    evaluation_present: false,
    evaluation: {
      overall_score: null, engagement_tier: null, engagement_rate: null,
      authenticity_score: null, authenticity_tier: null,
      brand_safety_tier: null, brand_safety_score: null,
      age_range: null, gender_split: null, top_locations: [],
      growth_pattern: null, risk_flags: [], niche_categories: [], recommendations: [],
    },
    bot_signals_panel: {
      present: false, score: null, tier: null,
      signals_triggered: null, total_signals: null, confidence_tier: null, top_signals: [],
    },
  };
}

// ─── Page Helpers ─────────────────────────────────────────────────────────────

async function waitForResults(page: Page): Promise<"results" | "no-results" | "error" | "loading"> {
  try {
    await Promise.race([
      page.waitForSelector('[data-testid="results-grid"]',  { timeout: SEARCH_TIMEOUT }),
      page.waitForSelector('[data-testid="no-results"]',    { timeout: SEARCH_TIMEOUT }),
      page.waitForSelector('[data-testid="loading-state"]', { timeout: 5000 }),
    ]);
    if (await page.locator('[data-testid="results-grid"]').isVisible().catch(() => false))  return "results";
    if (await page.locator('[data-testid="no-results"]').isVisible().catch(() => false))    return "no-results";
    return "loading";
  } catch {
    return "error";
  }
}

async function applyFilters(page: Page, combo: ReturnType<typeof generateCombos>[number]) {
  await page.goto("/search", { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(500);

  // Keyword
  const input = page.locator('[data-testid="search-input"]');
  await input.clear();
  await input.fill(combo.keyword);

  // Platform — toggle matching checkbox; uncheck others
  for (const p of PLATFORMS) {
    const checkbox = page.locator(`[data-testid="platform-${p.toLowerCase()}"]`);
    const isChecked = await checkbox.isChecked().catch(() => false);
    const shouldBeChecked = p === combo.platform;
    if (isChecked !== shouldBeChecked) {
      await checkbox.click().catch(() => {});
      await page.waitForTimeout(150);
    }
  }

  // Niches — deselect all active, then select targets
  const allNicheButtons = page.locator('[data-testid^="niche-btn-"]');
  const count = await allNicheButtons.count();
  for (let i = 0; i < count; i++) {
    const btn = allNicheButtons.nth(i);
    const isActive = (await btn.getAttribute("data-active")) === "true";
    if (isActive) await btn.click().catch(() => {});
  }
  for (const niche of combo.niches) {
    const nicheBtn = page.locator(`[data-testid="niche-btn-${niche.toLowerCase()}"]`);
    if (await nicheBtn.isVisible().catch(() => false)) {
      await nicheBtn.click().catch(() => {});
      await page.waitForTimeout(100);
    }
  }

  // City
  if (combo.city) {
    const citySelect = page.locator("select").first();
    if (await citySelect.isVisible().catch(() => false)) {
      await citySelect.selectOption({ label: combo.city }).catch(() => {});
    }
  }

  // Follower range
  if (combo.followerRange !== "any") {
    const rangeBtn = page.locator(`[data-value="${combo.followerRange}"]`).first();
    if (await rangeBtn.isVisible().catch(() => false)) {
      await rangeBtn.click().catch(() => {});
    }
  }

  // Submit
  await page.locator('[data-testid="search-btn"]').click();
}

async function extractAllCards(page: Page): Promise<SearchCardData[]> {
  await page.waitForTimeout(1000); // let render settle

  return page.evaluate(() => {
    function parseFollowersRaw(text: string | null): number | null {
      if (!text || text === "—") return null;
      const t = text.replace(/,/g, "").trim();
      if (t.endsWith("M")) return parseFloat(t) * 1_000_000;
      if (t.endsWith("K")) return parseFloat(t) * 1_000;
      const n = parseFloat(t);
      return isNaN(n) ? null : n;
    }

    return Array.from(document.querySelectorAll('[data-testid="result-card"]')).map((card, idx) => {
      const q  = (sel: string) => card.querySelector(sel)?.textContent?.trim() ?? null;
      const qa = (sel: string, attr: string) => (card.querySelector(sel) as HTMLElement)?.getAttribute(attr) ?? null;

      const engBadge = card.querySelector(
        '[data-testid="card-engagement"] ~ div span, [data-testid="card-engagement"] + div span'
      );

      const hasVerified = !!card.querySelector('.bg-green-500, [class*="bg-green"]');
      const isStale     = !!(card.querySelector('[class*="STALE"]') || card.textContent?.includes("STALE"));

      const scoreEl   = card.querySelector('[class*="score"], [class*="Score"]');
      const scoreText = scoreEl?.textContent?.replace(/[^0-9.]/g, "") ?? null;
      const iqScore   = scoreText && !isNaN(parseFloat(scoreText)) ? parseFloat(scoreText) : null;

      const followersDisplay = q('[data-testid="card-followers"]');

      return {
        position:           idx + 1,
        username:           qa('[data-testid="result-card"], [data-username]', "data-username")
                              ?? card.querySelector("p.text-xs")?.textContent?.replace("@", "").trim() ?? "unknown",
        full_name:          card.querySelector("p.text-sm.font-medium")?.textContent?.trim() ?? null,
        platform:           qa('[data-testid="result-card"]', "data-platform") ?? q('[data-testid="card-platform"]'),
        niche:              q('[data-testid="card-niche"]'),
        city:               q('[data-testid="card-city"]'),
        bio:                card.querySelector(".line-clamp-2, [class*=\"line-clamp\"]")?.textContent?.trim() ?? null,
        followers_display:  followersDisplay,
        followers_raw:      parseFollowersRaw(followersDisplay),
        engagement_display: q('[data-testid="card-engagement"]'),
        engagement_source:  engBadge?.textContent?.trim() ?? null,
        iq_score:           iqScore,
        is_enriched:        hasVerified,
        is_stale:           isStale,
        profile_link:       (card.querySelector('a[href*="/influencer/"]') as HTMLAnchorElement)?.href ?? null,
        avatar_type:        (card.querySelector("img[alt]") ? "image" : "initials") as "image" | "initials",
        has_verified_badge: hasVerified,
      };
    });
  });
}

async function extractProfilePageData(page: Page, profileUrl: string): Promise<ProfilePageData> {
  const base = emptyProfile();

  try {
    await page.goto(profileUrl, { waitUntil: "networkidle", timeout: PROFILE_TIMEOUT });
    await page.waitForTimeout(2000); // let async data settle

    base.visited    = true;
    base.visited_at = new Date().toISOString();

    const data = await page.evaluate(() => {
      const q    = (sel: string) => document.querySelector(sel)?.textContent?.trim() ?? null;
      const qa   = (sel: string, attr: string) => (document.querySelector(sel) as HTMLElement)?.getAttribute(attr) ?? null;
      const qall = (sel: string) =>
        Array.from(document.querySelectorAll(sel))
          .map(el => el.textContent?.trim() ?? "")
          .filter(Boolean);

      // ── Header ──────────────────────────────────────────────────────────────
      const h1     = q("h1");
      const subline = document.querySelector("p.text-sm.text-muted-foreground")?.textContent?.trim() ?? null;
      const parts   = subline?.split("·").map((s: string) => s.trim()) ?? [];
      const username = parts[0]?.replace("@", "") ?? null;
      const platform = parts[1] ?? null;
      const niche    = parts[2] ?? null;

      // Bio — first paragraph with meaningful content
      const allPs = Array.from(document.querySelectorAll("p.text-sm, p.text-xs"));
      const bioEl = allPs.find(el => {
        const t = el.textContent?.trim() ?? "";
        return t.length > 20 && !t.includes("·") && !t.includes("@") &&
               !t.includes("Followers") && !t.includes("Engagement");
      });

      // City + joined from metadata row
      const metaItems = qall(".flex.items-center.gap-1");
      const cityItem   = metaItems.find((t: string) =>
        !t.includes("Profile Link") && !t.includes("Joined") && t.length < 50
      ) ?? null;
      const joinedItem = metaItems.find((t: string) => t.includes("Joined")) ?? null;
      const joinedYear = joinedItem?.replace("Joined", "").trim() ?? null;

      // Stats grid
      const statCards = Array.from(
        document.querySelectorAll(".bg-muted\\/40, [class*='rounded-xl']")
      ).filter(el =>
        el.querySelector("p.text-base") &&
        el.querySelector("p.text-\\[11px\\], p.text-xs")
      );
      const statMap: Record<string, string> = {};
      for (const card of statCards) {
        const label = card.querySelector("p.text-\\[11px\\], p.text-xs")?.textContent?.trim() ?? "";
        const value = card.querySelector("p.text-base")?.textContent?.trim() ?? "";
        if (label && value) statMap[label] = value;
      }

      // ── Quality signals ──────────────────────────────────────────────────────
      const iqBadgeText = Array.from(document.querySelectorAll("span, div")).find(
        el => el.textContent?.trim().startsWith("IQ:")
      )?.textContent?.trim() ?? null;
      const overallScore = iqBadgeText ? parseFloat(iqBadgeText.replace("IQ:", "").trim()) : null;

      const aqEl = Array.from(document.querySelectorAll("span")).find(
        el => el.textContent?.includes("Audience Quality:")
      );
      const aqParts = aqEl?.parentElement?.textContent?.match(/Audience Quality:\s*([0-9.]+)\/100/);
      const audienceQualityScore = aqParts ? parseFloat(aqParts[1]) : null;

      // Bot Risk Score panel
      const botPanel = Array.from(document.querySelectorAll("div")).find(
        el => el.querySelector("p")?.textContent?.includes("Bot Risk Score")
      );
      let botScore: number | null          = null;
      let botTier: string | null           = null;
      let signalsTriggered: number | null  = null;
      let totalSignals: number | null      = null;
      let confidenceTier: string | null    = null;
      const topSignals: string[]           = [];

      if (botPanel) {
        const scoreEl   = botPanel.querySelector("[class*='font-black']");
        botScore        = scoreEl ? parseFloat(scoreEl.textContent?.replace(/[^0-9.]/g, "") ?? "") : null;
        const tierEl    = botPanel.querySelector("[class*='rounded-full'][class*='border']");
        botTier         = tierEl?.textContent?.trim() ?? null;

        const summary   = Array.from(botPanel.querySelectorAll("span, summary")).find(
          el => el.textContent?.includes("signals triggered")
        );
        const sigMatch  = summary?.textContent?.match(/(\d+) of (\d+) signals triggered/);
        if (sigMatch) {
          signalsTriggered = parseInt(sigMatch[1]);
          totalSignals     = parseInt(sigMatch[2]);
        }

        topSignals.push(
          ...Array.from(botPanel.querySelectorAll("p.text-xs"))
            .slice(0, 5)
            .map(el => el.textContent?.trim() ?? "")
            .filter(Boolean)
        );

        const confEl    = Array.from(botPanel.querySelectorAll("p")).find(
          el => el.textContent?.includes("Detection confidence:")
        );
        confidenceTier  = confEl?.textContent?.replace("Detection confidence:", "").trim() ?? null;
      }

      // Data source badge
      const sourceEl = Array.from(document.querySelectorAll("span")).find(
        el =>
          el.textContent?.includes("YouTube Verified") ||
          el.textContent?.includes("Simulated Data") ||
          el.textContent?.includes("Data from Google")
      );

      // Enrichment failed badge
      const enrichFailed = !!Array.from(document.querySelectorAll("span")).find(
        el => el.textContent?.includes("enrichment failed")
      );

      // Stale badge
      const isStale = !!document.querySelector(
        "button:has([class*='ShieldAlert']), [class*='stale']"
      );

      // Profile external link
      const profileLinkEl = Array.from(document.querySelectorAll("a")).find(
        el => el.textContent?.trim() === "Profile Link"
      ) as HTMLAnchorElement | undefined;

      // ── Follower growth chart ─────────────────────────────────────────────────
      const historyPoints = document.querySelectorAll(
        ".recharts-dot, circle.recharts-dot"
      ).length;

      // ── Content performance table ─────────────────────────────────────────────
      const contentPerf = Array.from(document.querySelectorAll("tbody tr"))
        .map(row => {
          const cells = Array.from(row.querySelectorAll("td")).map(
            td => td.textContent?.trim() ?? ""
          );
          return {
            type:      cells[0]?.replace(/s$/, "") ?? "",
            posts:     parseInt(cells[1] ?? "0") || 0,
            sponsored: parseInt(cells[2] ?? "0") || 0,
            organic:   parseInt(cells[3] ?? "0") || 0,
          };
        })
        .filter(r => r.type);

      // ── AI Evaluation report ──────────────────────────────────────────────────
      const evalPresent = Array.from(document.querySelectorAll("h2")).some(
        el => el.textContent?.includes("AI Evaluation Report")
      );

      let evalData = {
        overall_score:      overallScore,
        engagement_tier:    null as string | null,
        engagement_rate:    null as string | null,
        authenticity_score: null as string | null,
        authenticity_tier:  null as string | null,
        brand_safety_tier:  null as string | null,
        brand_safety_score: null as string | null,
        age_range:          null as string | null,
        gender_split:       null as string | null,
        top_locations:      [] as string[],
        growth_pattern:     null as string | null,
        risk_flags:         [] as string[],
        niche_categories:   [] as string[],
        recommendations:    [] as string[],
      };

      if (evalPresent) {
        // Age range
        const ageLabel = Array.from(document.querySelectorAll("p.text-xs.text-primary")).find(
          el => el.closest("div")?.querySelector("p.text-xs.text-muted-foreground")?.textContent?.includes("Age Range")
        );
        evalData.age_range = ageLabel?.textContent?.trim() ?? null;

        // Gender split
        const genderLabel = Array.from(document.querySelectorAll("p.text-xs.text-primary")).find(
          el => el.closest("div")?.querySelector("p.text-xs.text-muted-foreground")?.textContent?.includes("Gender")
        );
        evalData.gender_split = genderLabel?.textContent?.trim() ?? null;

        // Top locations — pill badges
        evalData.top_locations = Array.from(
          document.querySelectorAll("[class*='rounded-full'][class*='border-border']")
        )
          .map(el => el.textContent?.trim() ?? "")
          .filter(t => t.length > 1 && t.length < 40)
          .slice(0, 5);

        // Growth assessment
        const growthSection = Array.from(document.querySelectorAll("p.text-sm.font-semibold")).find(
          el => el.textContent?.includes("Growth Assessment")
        );
        if (growthSection) {
          evalData.growth_pattern = growthSection.nextElementSibling?.textContent?.trim() ?? null;
          evalData.risk_flags = Array.from(
            growthSection.parentElement?.querySelectorAll("[class*='badge'], span[class*='amber']") ?? []
          ).map(el => el.textContent?.trim() ?? "").filter(Boolean);
        }

        // Niche categories
        evalData.niche_categories = Array.from(
          document.querySelectorAll("[class*='niche'], [class*='tag'], [class*='badge'][class*='primary']")
        )
          .map(el => el.textContent?.trim() ?? "")
          .filter(t => t.length > 1 && t.length < 30)
          .slice(0, 6);

        // Recommendations
        evalData.recommendations = Array.from(
          document.querySelectorAll("ul li, li.flex.items-start")
        )
          .map(el => el.textContent?.trim() ?? "")
          .filter(t => t.length > 10 && t.length < 200)
          .slice(0, 6);
      }

      return {
        full_name:             h1,
        username,
        platform,
        niche,
        city:                  cityItem,
        joined_year:           joinedYear,
        bio:                   bioEl?.textContent?.trim() ?? null,
        profile_link:          profileLinkEl?.href ?? null,
        followers:             statMap["Followers"] ?? null,
        following:             statMap["Following"] ?? null,
        posts_count:           statMap["Posts"] ?? null,
        engagement_rate:       statMap["Engagement"] ?? null,
        overall_score:         overallScore,
        audience_quality_score: audienceQualityScore,
        bot_probability_raw:   botScore,
        bot_risk_tier:         botTier,
        data_source_badge:     sourceEl?.textContent?.trim() ?? null,
        enrichment_status:     enrichFailed ? "failed" : null,
        is_stale_badge:        isStale,
        follower_history_points: historyPoints,
        follower_history_first: null,
        follower_history_last:  null,
        content_performance:   contentPerf,
        evaluation_present:    evalPresent,
        evaluation:            evalData,
        bot_signals_panel: {
          present:           !!botPanel,
          score:             botScore,
          tier:              botTier,
          signals_triggered: signalsTriggered,
          total_signals:     totalSignals,
          confidence_tier:   confidenceTier,
          top_signals:       topSignals,
        },
      };
    });

    Object.assign(base, data);
    return base;
  } catch (err: any) {
    base.visited    = true;
    base.visited_at = new Date().toISOString();
    base.error      = (err as Error).message ?? String(err);
    return base;
  }
}

// ─── Combo Runner ─────────────────────────────────────────────────────────────
async function runCombo(
  page: Page,
  combo: ReturnType<typeof generateCombos>[number],
  comboId: number,
): Promise<ComboResult> {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on("response", res => {
    if (res.status() >= 400) networkErrors.push(`${res.status()} ${res.url().slice(0, 120)}`);
  });

  const startTime = Date.now();
  await applyFilters(page, combo);
  const state         = await waitForResults(page);
  const searchDuration = Date.now() - startTime;

  let cards: SearchCardData[] = [];
  if (state === "results") {
    cards = await extractAllCards(page);
  }

  // Visit profiles up to PROFILE_DEPTH
  const capturedCards: CapturedCard[] = [];
  const toVisit = cards.slice(0, PROFILE_DEPTH);

  for (const card of toVisit) {
    let profileData = emptyProfile();

    if (card.profile_link || (card.username && card.platform)) {
      const url = card.profile_link ||
        `/influencer/${card.platform?.toLowerCase()}/${card.username.replace("@", "")}`;
      profileData = await extractProfilePageData(page, url);
      await page.waitForTimeout(INTER_ACTION_MS);
      await page.goBack({ waitUntil: "networkidle", timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    capturedCards.push({ search_card: card, profile_page: profileData });
  }

  // Remaining cards (beyond PROFILE_DEPTH) — search data only
  for (const card of cards.slice(PROFILE_DEPTH)) {
    capturedCards.push({ search_card: card, profile_page: emptyProfile() });
  }

  return {
    combo_id:            comboId,
    run_at:              new Date().toISOString(),
    filters: {
      platform:       combo.platform,
      niches:         combo.niches,
      city:           combo.city,
      follower_range: combo.followerRange,
      keyword:        combo.keyword,
      combo_type:     combo.type,
    },
    search_duration_ms:  searchDuration,
    card_count_rendered: cards.length,
    profiles_visited:    toVisit.length,
    cards:               capturedCards,
    console_errors:      [...new Set(consoleErrors)],
    network_errors:      [...new Set(networkErrors)],
  };
}

// ─── Report Writer ────────────────────────────────────────────────────────────
function writeReports(allResults: ComboResult[]) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const totalCards    = allResults.reduce((s, r) => s + r.card_count_rendered, 0);
  const totalVisited  = allResults.reduce((s, r) => s + r.profiles_visited, 0);

  // ── Full JSON dump ────────────────────────────────────────────────────────
  const jsonPath = path.join(OUT_DIR, `deep-capture-${RUN_ID}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({
    meta: {
      run_id:                 RUN_ID,
      generated_at:           new Date().toISOString(),
      total_combos:           allResults.length,
      total_cards_captured:   totalCards,
      total_profiles_visited: totalVisited,
      profile_depth:          PROFILE_DEPTH,
      combo_limit:            COMBO_LIMIT,
    },
    combos: allResults,
  }, null, 2));

  // ── Human-readable Markdown ───────────────────────────────────────────────
  const mdLines: string[] = [
    `# MUSHIN Deep Capture Results`,
    `**Run:** ${RUN_ID}  `,
    `**Combos:** ${allResults.length} | **Cards captured:** ${totalCards} | **Profiles visited:** ${totalVisited}`,
    "",
  ];

  for (const result of allResults) {
    const f = result.filters;
    mdLines.push(`---`);
    mdLines.push(`## Combo #${result.combo_id} · ${f.combo_type.toUpperCase()}`);
    mdLines.push(
      `**Platform:** ${f.platform} | **Niches:** ${f.niches.join("+") || "—"} | ` +
      `**City:** ${f.city} | **Range:** ${f.follower_range} | **Keyword:** \`${f.keyword}\``
    );
    mdLines.push(
      `**Results:** ${result.card_count_rendered} cards | ` +
      `**Search time:** ${result.search_duration_ms}ms | ` +
      `**Profiles visited:** ${result.profiles_visited}`
    );

    if (result.console_errors.length > 0) {
      mdLines.push(`> ⚠️ **Console errors:** ${result.console_errors.slice(0, 3).join(" | ")}`);
    }
    if (result.card_count_rendered === 0) {
      mdLines.push(`> 🔴 **No results returned**`);
    }

    for (const card of result.cards) {
      const sc = card.search_card;
      const pp = card.profile_page;

      mdLines.push(`\n### ${sc.position}. @${sc.username} · ${sc.platform ?? "?"}`);
      mdLines.push(`| Field | Value |`);
      mdLines.push(`|-------|-------|`);
      mdLines.push(`| Full name | ${sc.full_name ?? "—"} |`);
      mdLines.push(`| Niche (card) | ${sc.niche ?? "—"} |`);
      mdLines.push(`| City (card) | ${sc.city ?? "—"} |`);
      mdLines.push(`| Bio (card) | ${(sc.bio ?? "—").slice(0, 100)} |`);
      mdLines.push(`| Followers (display) | ${sc.followers_display ?? "—"} |`);
      mdLines.push(`| Followers (raw) | ${sc.followers_raw ?? "—"} |`);
      mdLines.push(`| Engagement | ${sc.engagement_display ?? "—"} (${sc.engagement_source ?? "?"}) |`);
      mdLines.push(`| IQ Score | ${sc.iq_score ?? "—"} |`);
      mdLines.push(`| Enriched | ${sc.is_enriched ? "✓ Yes" : "No"} |`);
      mdLines.push(`| Stale | ${sc.is_stale ? "⚠️ Yes" : "No"} |`);

      if (!pp.visited) {
        mdLines.push(`> *Profile not visited (beyond depth limit)*`);
        continue;
      }
      if (pp.error) {
        mdLines.push(`> ❌ **Profile load error:** ${pp.error}`);
        continue;
      }

      mdLines.push(`\n**Profile page data:**`);
      mdLines.push(`| Field | Value |`);
      mdLines.push(`|-------|-------|`);
      mdLines.push(`| Full name | ${pp.full_name ?? "—"} |`);
      mdLines.push(`| Platform | ${pp.platform ?? "—"} |`);
      mdLines.push(`| Niche | ${pp.niche ?? "—"} |`);
      mdLines.push(`| City | ${pp.city ?? "—"} |`);
      mdLines.push(`| Joined | ${pp.joined_year ?? "—"} |`);
      mdLines.push(`| Bio | ${(pp.bio ?? "—").slice(0, 150)} |`);
      mdLines.push(`| Followers | ${pp.followers ?? "—"} |`);
      mdLines.push(`| Following | ${pp.following ?? "—"} |`);
      mdLines.push(`| Posts | ${pp.posts_count ?? "—"} |`);
      mdLines.push(`| Engagement | ${pp.engagement_rate ?? "—"} |`);
      mdLines.push(`| IQ Score | ${pp.overall_score ?? "—"} |`);
      mdLines.push(`| Audience Quality | ${pp.audience_quality_score ?? "—"}/100 |`);
      mdLines.push(`| Bot Risk | ${pp.bot_probability_raw ?? "—"}/100 (${pp.bot_risk_tier ?? "—"}) |`);
      mdLines.push(`| Data Source | ${pp.data_source_badge ?? "—"} |`);
      mdLines.push(`| Enrichment | ${pp.enrichment_status ?? "ok"} |`);
      mdLines.push(`| Follower history pts | ${pp.follower_history_points} |`);

      if (pp.content_performance.length > 0) {
        mdLines.push(`\n**Content Performance:**`);
        mdLines.push(`| Type | Posts | Sponsored | Organic |`);
        mdLines.push(`|------|-------|-----------|---------|`);
        for (const row of pp.content_performance) {
          mdLines.push(`| ${row.type} | ${row.posts} | ${row.sponsored} | ${row.organic} |`);
        }
      }

      if (pp.evaluation_present) {
        const ev = pp.evaluation;
        mdLines.push(`\n**AI Evaluation:**`);
        mdLines.push(`- Score: ${ev.overall_score ?? "—"}`);
        mdLines.push(`- Engagement: ${ev.engagement_tier ?? "—"} (${ev.engagement_rate ?? "—"})`);
        mdLines.push(`- Authenticity: ${ev.authenticity_tier ?? "—"} (${ev.authenticity_score ?? "—"})`);
        mdLines.push(`- Brand Safety: ${ev.brand_safety_tier ?? "—"}`);
        mdLines.push(`- Demographics: ${ev.age_range ?? "—"} | ${ev.gender_split ?? "—"}`);
        mdLines.push(`- Top locations: ${ev.top_locations.join(", ") || "—"}`);
        mdLines.push(`- Growth: ${(ev.growth_pattern ?? "—").slice(0, 100)}`);
        if (ev.risk_flags.length > 0)      mdLines.push(`- ⚠️ Risk flags: ${ev.risk_flags.join(", ")}`);
        if (ev.niche_categories.length > 0) mdLines.push(`- Niches: ${ev.niche_categories.join(", ")}`);
      }

      if (pp.bot_signals_panel.present) {
        const bs = pp.bot_signals_panel;
        mdLines.push(
          `\n**Bot Signals:** Score=${bs.score}/100 | Tier=${bs.tier} | ` +
          `${bs.signals_triggered}/${bs.total_signals} signals | Confidence=${bs.confidence_tier}`
        );
        if (bs.top_signals.length > 0) {
          mdLines.push(`- ${bs.top_signals.slice(0, 3).join("\n- ")}`);
        }
      }
    }

    mdLines.push("");
  }

  const mdPath = path.join(OUT_DIR, `deep-capture-${RUN_ID}.md`);
  fs.writeFileSync(mdPath, mdLines.join("\n"));

  // ── Summary CSV ───────────────────────────────────────────────────────────
  const csvHeaders = [
    "combo_id","combo_type","platform_filter","niche_filter","city_filter","range_filter","keyword",
    "card_position","username","full_name","platform","niche","city","bio_length",
    "followers_raw","engagement_display","engagement_source","iq_score","is_enriched","is_stale",
    "profile_followers","profile_following","profile_posts","profile_engagement",
    "profile_overall_score","audience_quality","bot_risk_score","bot_tier","data_source",
    "enrichment_status","history_points","eval_present",
    "eval_score","eval_engagement_tier","eval_auth_tier","eval_brand_safety","eval_age_range","eval_gender",
    "bot_signals_triggered","bot_signals_total",
  ];
  const csvRows = [csvHeaders.join(",")];

  for (const result of allResults) {
    for (const card of result.cards) {
      const sc = card.search_card;
      const pp = card.profile_page;
      const ev = pp.evaluation;
      csvRows.push([
        result.combo_id,
        result.filters.combo_type,
        result.filters.platform,
        result.filters.niches.join("+"),
        result.filters.city,
        result.filters.follower_range,
        `"${result.filters.keyword.replace(/"/g, "'")}"`,
        sc.position,
        sc.username,
        `"${(sc.full_name ?? "").replace(/"/g, "'")}"`,
        sc.platform,
        sc.niche,
        sc.city,
        (sc.bio ?? "").length,
        sc.followers_raw,
        sc.engagement_display,
        sc.engagement_source,
        sc.iq_score,
        sc.is_enriched,
        sc.is_stale,
        pp.followers,
        pp.following,
        pp.posts_count,
        pp.engagement_rate,
        pp.overall_score,
        pp.audience_quality_score,
        pp.bot_probability_raw,
        pp.bot_risk_tier,
        pp.data_source_badge,
        pp.enrichment_status,
        pp.follower_history_points,
        pp.evaluation_present,
        ev.overall_score,
        ev.engagement_tier,
        ev.authenticity_tier,
        ev.brand_safety_tier,
        `"${ev.age_range ?? ""}"`,
        `"${ev.gender_split ?? ""}"`,
        pp.bot_signals_panel.signals_triggered,
        pp.bot_signals_panel.total_signals,
      ].join(","));
    }
  }

  const csvPath = path.join(OUT_DIR, `deep-capture-${RUN_ID}.csv`);
  fs.writeFileSync(csvPath, csvRows.join("\n"));

  console.log(`\n📦 Results saved:`);
  console.log(`   JSON : ${jsonPath}`);
  console.log(`   MD   : ${mdPath}`);
  console.log(`   CSV  : ${csvPath}`);
  console.log(`\n📊 Summary: ${allResults.length} combos | ${totalCards} cards captured | ${totalVisited} profiles visited`);
}

// ─── Test Suite ────────────────────────────────────────────────────────────────
const allResults: ComboResult[] = [];
const combos = generateCombos(COMBO_LIMIT);

test.afterAll(() => {
  writeReports(allResults);
});

test.describe("MUSHIN Deep Capture", () => {
  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    const label =
      `#${i + 1} ${combo.type} | ${combo.platform} | ` +
      `${combo.niches.join("+") || "no-niche"} | ${combo.city} | ${combo.followerRange}`;

    test(label, async ({ page }) => {
      test.setTimeout(PROFILE_TIMEOUT * (PROFILE_DEPTH + 1) + 30_000);

      const result = await runCombo(page, combo, i + 1);
      allResults.push(result);

      // Soft assertions — do not abort the suite on quality issues,
      // only on hard failures (page crash, stuck loading, etc.)
      if (result.card_count_rendered > 0) {
        const missingUsernames = result.cards.filter(
          c => !c.search_card.username || c.search_card.username === "unknown"
        );
        expect(missingUsernames.length, `${missingUsernames.length} cards missing username`).toBe(0);
      }

      const stillLoading = await page
        .locator('[data-testid="loading-state"]')
        .isVisible()
        .catch(() => false);
      expect(stillLoading, "Search stuck in loading state").toBe(false);

      console.log(
        `  ✓ Combo #${i + 1}: ${result.card_count_rendered} cards | ` +
        `${result.profiles_visited} profiles visited | ${result.search_duration_ms}ms`
      );
    });
  }
});
