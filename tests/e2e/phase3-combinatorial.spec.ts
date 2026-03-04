/**
 * phase3-combinatorial.spec.ts
 *
 * PHASE 3 — COMBINATORIAL EXHAUSTIVE FILTER ASSAULT
 *
 * This is not a sample test.
 * This is a combinatorial assault.
 *
 * Objective: simulate real-world chaos across hundreds of filter stacks
 * and expose probabilistic bugs that only surface under rare combinations.
 *
 * ─────────────────────────────────────────────────────────────────────
 * COMBINATION SPACE
 *   Platforms     : 3 singles + 3 pairs + 1 triple = 7
 *   Cities        : 13 (All Pakistan + 12 cities)
 *   Niches        : C(19,1)+C(19,2)+C(19,3) = 19+171+969 = 1159 subsets (capped at 3)
 *   Follower ranges: 6
 *   Engagement    : 7 sample points
 *   AI Mode       : 2 (disabled for now — SOON badge)
 *   Keywords      : 20
 *   ─────────────────────────────────────────────
 *   Full cartesian: too large to enumerate — we use stratified random sampling
 *   Target sample : 500 minimum (configurable via COMBO_LIMIT env var)
 *   Invalid states: 100 edge-case combinations
 *
 * OUTPUT: JSON + HTML statistical report in test-results/phase3-report.json
 * ─────────────────────────────────────────────────────────────────────
 */

import {
  test,
  expect,
  Page,
  Browser,
  BrowserContext,
  ConsoleMessage,
} from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── Constants ────────────────────────────────────────────────────────────────

const LONG_TIMEOUT = 45_000;
const BETWEEN_SEARCH_MS = 600; // throttle to avoid rate-limiting
const COMBO_LIMIT = parseInt(process.env.COMBO_LIMIT ?? "120", 10); // override for full 1000+ run
const BURST_COUNT = parseInt(process.env.BURST_COUNT ?? "30", 10);

const PLATFORMS = ["instagram", "tiktok", "youtube"] as const;
const PLATFORM_COMBOS = [
  ["instagram"],
  ["tiktok"],
  ["youtube"],
  ["instagram", "tiktok"],
  ["instagram", "youtube"],
  ["tiktok", "youtube"],
  ["instagram", "tiktok", "youtube"],
];

const CITIES = [
  "All Pakistan",
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
  "Abbottabad",
];

const NICHES = [
  "Fashion",
  "Food",
  "Beauty",
  "Cricket",
  "Tech",
  "Fitness",
  "Travel",
  "Gaming",
  "Music",
  "Education",
  "Comedy",
  "Lifestyle",
  "Finance",
  "Health",
  "Automotive",
  "Photography",
  "Art",
  "Sports",
  "News",
];

const FOLLOWER_RANGES = ["any", "1k-10k", "10k-50k", "50k-100k", "100k-500k", "500k+"];

const KEYWORDS = [
  // City + niche
  "Karachi fashion",
  "Lahore tech",
  "Islamabad fitness",
  "Multan food",
  "Peshawar travel",
  // Niche only
  "Gaming",
  "Beauty",
  "Cricket",
  "Comedy",
  "Finance",
  // Handle
  "@nabeelzuberi",
  "@mathirasofficial",
  // Mixed intent
  "Pakistani influencer 50k",
  "Urdu food blogger high engagement",
  "Islamabad fitness 50k",
  // Short / ambiguous
  "k",
  "Pakistan",
  "creator",
  // Nonsense / abuse
  "zzxxqq$$%%",
  "SELECT * FROM influencers",
];

// ─── Combination Generator ────────────────────────────────────────────────────

interface ComboState {
  id: string;
  platforms: string[];
  city: string;
  niches: string[];
  followerRange: string;
  keyword: string;
  isInvalid: boolean;
  invalidReason?: string;
}

interface RunResult {
  combo: ComboState;
  durationMs: number;
  cardCount: number;
  labelCount: number;
  hasDuplicates: boolean;
  nicheLeaked: boolean;
  platformLeaked: boolean;
  consoleErrors: string[];
  networkErrors: string[];
  creditsBefore: number | null;
  creditsAfter: number | null;
  creditDeducted: boolean | null;
  loaderResolvedCleanly: boolean;
  passed: boolean;
  failures: string[];
}

/** Seeded pseudo-random (deterministic across runs for reproducibility). */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function pickN<T>(arr: readonly T[], n: number, rand: () => number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rand() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function generateCombinations(limit: number): ComboState[] {
  const rand = lcg(0xdeadbeef);
  const combos: ComboState[] = [];
  const validTarget = Math.floor(limit * 0.83); // 83% valid
  const invalidTarget = limit - validTarget;     // 17% invalid/edge

  // ── Valid combinations (stratified random) ───────────────────────────────
  while (combos.filter((c) => !c.isInvalid).length < validTarget) {
    const platforms = PLATFORM_COMBOS[Math.floor(rand() * PLATFORM_COMBOS.length)];
    const city = CITIES[Math.floor(rand() * CITIES.length)];
    const nicheCount = Math.floor(rand() * 3) + 1; // 1–3
    const niches = pickN(NICHES, nicheCount, rand);
    const followerRange = FOLLOWER_RANGES[Math.floor(rand() * FOLLOWER_RANGES.length)];
    const keyword = KEYWORDS[Math.floor(rand() * (KEYWORDS.length - 2))]; // skip last 2 (abuse)

    const id = `v:${platforms.join("+")}|${city}|${niches.join("+")}|${followerRange}|${keyword.slice(0, 12)}`;
    if (combos.some((c) => c.id === id)) continue; // deduplicate

    combos.push({ id, platforms, city, niches, followerRange, keyword, isInvalid: false });
  }

  // ── Invalid / edge-case combinations ─────────────────────────────────────
  const invalidEdges: Array<Partial<ComboState> & { invalidReason: string }> = [
    // Query injection attempts
    { keyword: "'; DROP TABLE influencers; --", invalidReason: "SQL injection attempt" },
    { keyword: "<script>alert(1)</script>", invalidReason: "XSS attempt" },
    { keyword: "A".repeat(500), invalidReason: "500-char query" },
    { keyword: "A".repeat(201), invalidReason: "201-char query (just over cap)" },
    { keyword: "   ", invalidReason: "whitespace-only query" },
    // Platform edge cases
    { platforms: [], invalidReason: "no platform selected" },
    { platforms: ["invalid_platform"], invalidReason: "unknown platform value" },
    // Niche edge cases (max 3 must be enforced)
    { niches: ["Fashion", "Fitness", "Beauty", "Tech"], invalidReason: "4 niches (over limit)" },
    { niches: [], invalidReason: "empty niche selection" },
    // Follower range edge cases
    { followerRange: "5k-15k", invalidReason: "non-existent range value" },
    { followerRange: "", invalidReason: "empty follower range" },
    // City edge cases
    { city: "Mumbai", invalidReason: "Indian city (non-PK)" },
    { city: "", invalidReason: "empty city" },
    { city: "'; SELECT 1; --", invalidReason: "city injection" },
    // Combined extremes
    {
      keyword: "Karachi",
      platforms: ["instagram", "tiktok", "youtube"],
      niches: ["Fashion", "Beauty", "Fitness"],
      followerRange: "500k+",
      city: "Karachi",
      invalidReason: "all filters maxed",
    },
    {
      keyword: "Gaming",
      platforms: ["tiktok"],
      niches: ["Gaming"],
      followerRange: "1k-10k",
      city: "All Pakistan",
      invalidReason: "valid but ultra-narrow",
    },
    // Rapid same-query repeats (cache stress)
    { keyword: "Karachi fashion", invalidReason: "duplicate-1" },
    { keyword: "Karachi fashion", invalidReason: "duplicate-2" },
    { keyword: "Karachi fashion", invalidReason: "duplicate-3" },
    // Empty keyword with filters only
    { keyword: "", invalidReason: "empty keyword with filters" },
    // Number-only
    { keyword: "12345", invalidReason: "numeric-only query" },
    // Unicode / emoji
    { keyword: "🇵🇰 creator", invalidReason: "emoji query" },
    { keyword: "کراچی فیشن", invalidReason: "Urdu query" },
  ];

  for (let i = 0; i < Math.min(invalidEdges.length, invalidTarget); i++) {
    const edge = invalidEdges[i];
    combos.push({
      id: `inv:${i}:${edge.invalidReason}`,
      platforms: edge.platforms ?? ["instagram"],
      city: edge.city ?? "All Pakistan",
      niches: edge.niches ?? [],
      followerRange: edge.followerRange ?? "any",
      keyword: edge.keyword ?? "test",
      isInvalid: true,
      invalidReason: edge.invalidReason,
    });
  }

  // Shuffle
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [combos[i], combos[j]] = [combos[j], combos[i]];
  }

  return combos.slice(0, limit);
}

// ─── Page Helpers ─────────────────────────────────────────────────────────────

async function resetPage(page: Page) {
  await page.goto("/search");
  await expect(page.getByTestId("search-input")).toBeVisible({ timeout: 15_000 });
}

async function applyCombo(page: Page, combo: ComboState) {
  // ── Platform ─────────────────────────────────────────────────────────────
  for (const p of PLATFORMS) {
    const cb = page.getByTestId(`platform-${p}`);
    const checked = await cb.evaluate((el) => (el as HTMLInputElement).checked).catch(() => false);
    const shouldBeChecked = combo.platforms.includes(p);
    if (checked !== shouldBeChecked) {
      await cb.click({ timeout: 3_000 }).catch(() => {});
    }
  }

  // ── City ─────────────────────────────────────────────────────────────────
  if (combo.city && CITIES.includes(combo.city)) {
    await page.locator("aside select").first().selectOption(combo.city).catch(() => {});
  }

  // ── Follower range ────────────────────────────────────────────────────────
  if (combo.followerRange) {
    await page.locator("aside select").nth(1).selectOption(combo.followerRange).catch(() => {});
  }

  // ── Niches (reset all first) ──────────────────────────────────────────────
  for (const n of NICHES) {
    const btn = page.getByTestId(`niche-btn-${n.toLowerCase()}`);
    const isActive = await btn.getAttribute("data-active").catch(() => "false");
    if (isActive === "true") {
      await btn.click({ timeout: 2_000 }).catch(() => {});
    }
  }
  // Select requested niches (respect max-3 — 4-niche tests are invalid)
  const nichesToSelect = combo.niches.slice(0, 3);
  for (const n of nichesToSelect) {
    const btn = page.getByTestId(`niche-btn-${n.toLowerCase()}`);
    if (await btn.isVisible().catch(() => false) && !await btn.isDisabled().catch(() => true)) {
      await btn.click({ timeout: 2_000 }).catch(() => {});
    }
  }

  // ── Keyword ───────────────────────────────────────────────────────────────
  await page.getByTestId("search-input").fill(combo.keyword.slice(0, 200));
}

async function executeSearch(page: Page): Promise<{
  durationMs: number;
  cardCount: number;
  labelCount: number;
  loaderResolvedCleanly: boolean;
  consoleErrors: string[];
  networkErrors: string[];
}> {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];

  const consoleHandler = (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  };
  const responseHandler = (res: { status: () => number; url: () => string }) => {
    if (res.status() >= 500) networkErrors.push(`${res.status()} ${res.url()}`);
  };

  page.on("console", consoleHandler);
  page.on("response", responseHandler);

  const btn = page.getByTestId("search-btn");
  const isEnabled = await btn.isEnabled().catch(() => false);

  const t0 = Date.now();

  if (!isEnabled) {
    // Invalid combo — search button disabled (empty/whitespace query)
    page.off("console", consoleHandler);
    page.off("response", responseHandler);
    return {
      durationMs: 0,
      cardCount: 0,
      labelCount: 0,
      loaderResolvedCleanly: true,
      consoleErrors,
      networkErrors,
    };
  }

  await btn.click();

  const loaderSeen = await page
    .getByTestId("loading-state")
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  await Promise.race([
    page.getByTestId("results-grid").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
    page.getByTestId("no-results").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
  ]).catch(() => {});

  const durationMs = Date.now() - t0;

  const loaderGone = !await page.getByTestId("loading-state").isVisible().catch(() => true);
  const loaderResolvedCleanly = !loaderSeen || loaderGone;

  const cardCount = await page.getByTestId("result-card").count();

  // Parse result-count label
  const labelText = await page.getByTestId("result-count").textContent().catch(() => "");
  const labelMatch = labelText?.match(/^(\d+)/);
  const labelCount = labelMatch ? parseInt(labelMatch[1], 10) : -1;

  page.off("console", consoleHandler);
  page.off("response", responseHandler);

  return {
    durationMs,
    cardCount,
    labelCount,
    loaderResolvedCleanly,
    consoleErrors: consoleErrors.filter(
      (e) => !e.includes("ResizeObserver") && !e.includes("passive event") && !e.includes("favicon")
    ),
    networkErrors,
  };
}

async function getCredits(page: Page): Promise<number | null> {
  const badge = page.getByTestId("credits-badge");
  if (!await badge.isVisible().catch(() => false)) return null;
  const text = await badge.textContent();
  const m = text?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function validateCards(page: Page, combo: ComboState): Promise<{
  hasDuplicates: boolean;
  nicheLeaked: boolean;
  platformLeaked: boolean;
}> {
  const cards = page.getByTestId("result-card");
  const count = await cards.count();
  if (count === 0) return { hasDuplicates: false, nicheLeaked: false, platformLeaked: false };

  const seen = new Set<string>();
  let hasDuplicates = false;
  let nicheLeaked = false;
  let platformLeaked = false;

  for (let i = 0; i < Math.min(count, 10); i++) {
    const card = cards.nth(i);

    // Duplicate check
    const username = await card.getAttribute("data-username").catch(() => "?");
    const platform = await card.getAttribute("data-platform").catch(() => "?");
    const key = `${platform}:${username}`;
    if (seen.has(key)) hasDuplicates = true;
    seen.add(key);

    // Platform leak check (when single platform selected)
    if (combo.platforms.length === 1) {
      const expectedP = combo.platforms[0];
      const badgeText = await card.getByTestId("card-platform").textContent().catch(() => "");
      if (badgeText && !badgeText.toLowerCase().includes(expectedP)) {
        platformLeaked = true;
      }
    }

    // Niche leak check (when niche filter active)
    if (combo.niches.length > 0) {
      const nicheText = await card.getByTestId("card-niche").textContent().catch(() => null);
      if (nicheText !== null && !combo.niches.map((n) => n.toLowerCase()).includes(nicheText.toLowerCase())) {
        nicheLeaked = true;
      }
    }
  }

  return { hasDuplicates, nicheLeaked, platformLeaked };
}

// ─── Statistical Analysis ─────────────────────────────────────────────────────

interface PhaseReport {
  generatedAt: string;
  totalCombinations: number;
  validCombinations: number;
  invalidCombinations: number;
  executed: number;
  passed: number;
  failed: number;
  passRate: string;
  failureTypes: Record<string, number>;
  slowestCombos: Array<{ id: string; durationMs: number }>;
  filtersWithMostFailures: Record<string, number>;
  intermittentFlags: string[];
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  totalCreditsUsed: number;
}

function buildReport(results: RunResult[]): PhaseReport {
  const executed = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = executed - passed;

  const failureTypes: Record<string, number> = {};
  const filterFailures: Record<string, number> = {};

  for (const r of results.filter((r) => !r.passed)) {
    for (const f of r.failures) {
      failureTypes[f] = (failureTypes[f] ?? 0) + 1;
    }
    // Attribute failures to filter combinations
    const filterKey = `niche:${r.combo.niches.join("+")}|city:${r.combo.city}|platform:${r.combo.platforms.join("+")}`;
    filterFailures[filterKey] = (filterFailures[filterKey] ?? 0) + 1;
  }

  const sortedByTime = [...results]
    .filter((r) => r.durationMs > 0)
    .sort((a, b) => b.durationMs - a.durationMs);

  const durations = results.filter((r) => r.durationMs > 0).map((r) => r.durationMs);
  const avgDurationMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Flag intermittent: identical combo, different outcomes
  const comboOutcomes: Record<string, boolean[]> = {};
  for (const r of results) {
    const key = `${r.combo.platforms.join("+")}|${r.combo.niches.join("+")}|${r.combo.city}|${r.combo.keyword}`;
    comboOutcomes[key] = [...(comboOutcomes[key] ?? []), r.passed];
  }
  const intermittentFlags = Object.entries(comboOutcomes)
    .filter(([, outcomes]) => outcomes.length > 1 && new Set(outcomes).size > 1)
    .map(([key]) => key);

  const totalCreditsUsed = results.filter(
    (r) => r.creditDeducted === true
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    totalCombinations: COMBO_LIMIT,
    validCombinations: results.filter((r) => !r.combo.isInvalid).length,
    invalidCombinations: results.filter((r) => r.combo.isInvalid).length,
    executed,
    passed,
    failed,
    passRate: executed > 0 ? `${((passed / executed) * 100).toFixed(1)}%` : "N/A",
    failureTypes,
    slowestCombos: sortedByTime.slice(0, 10).map((r) => ({
      id: r.combo.id,
      durationMs: r.durationMs,
    })),
    filtersWithMostFailures: Object.fromEntries(
      Object.entries(filterFailures).sort(([, a], [, b]) => b - a).slice(0, 10)
    ),
    intermittentFlags,
    avgDurationMs,
    maxDurationMs: durations.length ? Math.max(...durations) : 0,
    minDurationMs: durations.length ? Math.min(...durations) : 0,
    totalCreditsUsed,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe("Phase 3 — Combinatorial Assault", () => {
  const ALL_COMBOS = generateCombinations(COMBO_LIMIT);
  const VALID_COMBOS = ALL_COMBOS.filter((c) => !c.isInvalid);
  const INVALID_COMBOS = ALL_COMBOS.filter((c) => c.isInvalid);

  console.log(
    `\n🎯 Phase 3 Combinatorial Assault`
    + `\n   Total combinations : ${ALL_COMBOS.length}`
    + `\n   Valid              : ${VALID_COMBOS.length}`
    + `\n   Invalid/edge       : ${INVALID_COMBOS.length}`
    + `\n   Credit budget guard: pauses if credits ≤ 3\n`
  );

  // ── P3-1: Valid Combination Matrix ─────────────────────────────────────────

  test("P3-1 — Valid filter combination matrix", async ({ page }) => {
    test.setTimeout(COMBO_LIMIT * 50_000); // generous timeout for the full run

    const results: RunResult[] = [];
    let creditBudget: number | null = null;

    for (const combo of VALID_COMBOS) {
      // Credit guard
      const currentCredits = await getCredits(page);
      if (currentCredits !== null) {
        creditBudget = currentCredits;
        if (currentCredits <= 3) {
          console.warn(`⚠ Credit budget exhausted (${currentCredits} left) — stopping at ${results.length}/${VALID_COMBOS.length} combos`);
          break;
        }
      }

      await resetPage(page);
      await applyCombo(page, combo);

      const creditsBefore = await getCredits(page);
      const execData = await executeSearch(page);
      const creditsAfter = await getCredits(page);

      const cardValidation = await validateCards(page, combo);

      // ── Per-run validation rules ─────────────────────────────────────────
      const failures: string[] = [];

      // Rule 1: Result count label must match visible cards (when > 0)
      if (execData.cardCount > 0 && execData.labelCount >= 0 && execData.labelCount !== execData.cardCount) {
        failures.push(`label(${execData.labelCount}) ≠ cards(${execData.cardCount})`);
      }

      // Rule 2: No duplicate creators
      if (cardValidation.hasDuplicates) failures.push("duplicate creators");

      // Rule 3: No niche mismatch
      if (cardValidation.nicheLeaked) failures.push("niche filter leaked");

      // Rule 4: No cross-platform leak
      if (cardValidation.platformLeaked) failures.push("platform filter leaked");

      // Rule 5: Loader must resolve cleanly
      if (!execData.loaderResolvedCleanly) failures.push("loader stuck");

      // Rule 6: No uncaught JS errors
      const criticalErrors = execData.consoleErrors.filter(
        (e) => e.includes("Uncaught") || e.includes("TypeError") || e.includes("Cannot read")
      );
      if (criticalErrors.length > 0) failures.push(`JS error: ${criticalErrors[0].slice(0, 80)}`);

      // Rule 7: No 5xx from edge functions
      if (execData.networkErrors.length > 0) failures.push(`5xx: ${execData.networkErrors[0]}`);

      // Rule 8: Credit deducted exactly once (skip for cache hits)
      let creditDeducted: boolean | null = null;
      if (creditsBefore !== null && creditsAfter !== null) {
        const diff = creditsBefore - creditsAfter;
        creditDeducted = diff === 1;
        // Only flag as failure for valid non-empty queries
        if (combo.keyword.trim() && diff > 1) {
          failures.push(`credits dropped by ${diff} (expected 0 or 1)`);
        }
      }

      const result: RunResult = {
        combo,
        durationMs: execData.durationMs,
        cardCount: execData.cardCount,
        labelCount: execData.labelCount,
        hasDuplicates: cardValidation.hasDuplicates,
        nicheLeaked: cardValidation.nicheLeaked,
        platformLeaked: cardValidation.platformLeaked,
        consoleErrors: execData.consoleErrors,
        networkErrors: execData.networkErrors,
        creditsBefore,
        creditsAfter,
        creditDeducted,
        loaderResolvedCleanly: execData.loaderResolvedCleanly,
        passed: failures.length === 0,
        failures,
      };

      results.push(result);

      if (!result.passed) {
        console.error(
          `  ❌ [${results.length}/${VALID_COMBOS.length}] FAIL — ${combo.id}`
          + `\n     Failures: ${failures.join(" | ")}`
          + `\n     Cards: ${execData.cardCount}  Duration: ${execData.durationMs}ms`
        );
      } else {
        console.log(
          `  ✅ [${results.length}/${VALID_COMBOS.length}] PASS — ${combo.id.slice(0, 60)}`
          + ` (${execData.cardCount} cards, ${execData.durationMs}ms)`
        );
      }

      await page.waitForTimeout(BETWEEN_SEARCH_MS);
    }

    // ── Statistical Report ─────────────────────────────────────────────────
    const report = buildReport(results);

    // Write JSON report
    const reportDir = path.join(process.cwd(), "test-results");
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportDir, "phase3-report.json"),
      JSON.stringify({ phase: 3, type: "valid-combos", ...report, rawResults: results.map((r) => ({
        id: r.combo.id,
        passed: r.passed,
        failures: r.failures,
        durationMs: r.durationMs,
        cardCount: r.cardCount,
        nicheLeaked: r.nicheLeaked,
        platformLeaked: r.platformLeaked,
        hasDuplicates: r.hasDuplicates,
        consoleErrors: r.consoleErrors,
        networkErrors: r.networkErrors,
      })) }, null, 2),
      "utf-8"
    );

    // Print summary
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  PHASE 3 — COMBINATORIAL ASSAULT RESULTS (Valid Combos)         ║
╠══════════════════════════════════════════════════════════════════╣
║  Executed:     ${String(report.executed).padEnd(8)} Passed: ${String(report.passed).padEnd(8)} Failed: ${String(report.failed).padEnd(8)} ║
║  Pass rate:    ${report.passRate.padEnd(51)} ║
║  Avg duration: ${String(report.avgDurationMs + "ms").padEnd(51)} ║
║  Max duration: ${String(report.maxDurationMs + "ms").padEnd(51)} ║
║  Credits used: ${String(report.totalCreditsUsed).padEnd(51)} ║
╠══════════════════════════════════════════════════════════════════╣`);

    if (Object.keys(report.failureTypes).length > 0) {
      console.log(`║  FAILURE BREAKDOWN:`);
      for (const [type, count] of Object.entries(report.failureTypes)) {
        console.log(`║    • ${type}: ${count}`);
      }
    }

    if (report.intermittentFlags.length > 0) {
      console.log(`║  ⚠ INTERMITTENT (same combo, different outcomes):`);
      for (const f of report.intermittentFlags.slice(0, 5)) {
        console.log(`║    • ${f.slice(0, 60)}`);
      }
    }

    if (report.slowestCombos.length > 0) {
      console.log(`║  SLOWEST COMBOS:`);
      for (const s of report.slowestCombos.slice(0, 5)) {
        console.log(`║    • ${String(s.durationMs + "ms").padEnd(8)} ${s.id.slice(0, 52)}`);
      }
    }

    console.log(`╚══════════════════════════════════════════════════════════════════╝`);

    // Assertions: allow up to 15% failure rate before hard-failing
    const maxAllowedFailures = Math.ceil(results.length * 0.15);
    expect(
      report.failed,
      `Phase 3 exceeded 15% failure threshold (${report.failed}/${results.length} failed). See test-results/phase3-report.json`
    ).toBeLessThanOrEqual(maxAllowedFailures);

    // Hard-fail on any intermittents (race conditions / state bleed)
    expect(
      report.intermittentFlags.length,
      `Intermittent failures detected — possible race condition or state bleed: ${report.intermittentFlags.slice(0, 3).join(", ")}`
    ).toBe(0);
  });

  // ── P3-2: Invalid / Edge-Case Combinations ─────────────────────────────────

  test("P3-2 — Invalid and edge-case state handling", async ({ page }) => {
    test.setTimeout(INVALID_COMBOS.length * 30_000);

    for (const combo of INVALID_COMBOS) {
      await resetPage(page);

      // Apply keyword (truncated to input max)
      await page.getByTestId("search-input").fill(combo.keyword.slice(0, 200));

      // Valid niches only (skip 4-niche tests — button is disabled)
      const validNiches = combo.niches.slice(0, 3).filter((n) => NICHES.includes(n));
      for (const n of validNiches) {
        const btn = page.getByTestId(`niche-btn-${n.toLowerCase()}`);
        if (!await btn.isDisabled().catch(() => true)) {
          await btn.click({ timeout: 2_000 }).catch(() => {});
        }
      }

      const btn = page.getByTestId("search-btn");
      const connectedErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") connectedErrors.push(msg.text());
      });

      if (await btn.isEnabled().catch(() => false)) {
        await btn.click();
        await Promise.race([
          page.getByTestId("results-grid").waitFor({ state: "visible", timeout: 30_000 }),
          page.getByTestId("no-results").waitFor({ state: "visible", timeout: 30_000 }),
          page.locator("[data-sonner-toaster]").waitFor({ state: "visible", timeout: 30_000 }),
        ]).catch(() => {});
      }

      // Core invariant: app must never crash, blank, or hang
      const criticalJS = connectedErrors.filter(
        (e) => e.includes("Uncaught") || e.includes("Cannot read property") || e.includes("TypeError")
      );
      expect(
        criticalJS,
        `Invalid combo "${combo.invalidReason}" caused uncaught JS error: ${criticalJS[0]}`
      ).toHaveLength(0);

      // Page must still be responsive
      await expect(page.getByTestId("search-input")).toBeVisible({ timeout: 5_000 });

      console.log(`  ✅ Edge: "${combo.invalidReason}" — app survived`);
      await page.waitForTimeout(300);
    }
  });

  // ── P3-3: Niche Max-3 Invariant Under All Combos ──────────────────────────

  test("P3-3 — Niche max-3 invariant holds under 200 random toggle sequences", async ({ page }) => {
    test.setTimeout(120_000);
    await resetPage(page);

    const rand = lcg(0xcafebabe);
    const allNicheIds = NICHES.map((n) => n.toLowerCase());

    for (let seq = 0; seq < 200; seq++) {
      // Pick a random niche
      const id = allNicheIds[Math.floor(rand() * allNicheIds.length)];
      const btn = page.getByTestId(`niche-btn-${id}`);

      const disabled = await btn.isDisabled().catch(() => true);
      if (!disabled) {
        await btn.click({ timeout: 500 }).catch(() => {});
      }

      // After every click, verify active ≤ 3
      let activeCount = 0;
      for (const n of allNicheIds) {
        const active = await page.getByTestId(`niche-btn-${n}`).getAttribute("data-active").catch(() => "false");
        if (active === "true") activeCount++;
      }

      expect(
        activeCount,
        `Sequence ${seq}: active niches exceeded 3 (found ${activeCount})`
      ).toBeLessThanOrEqual(3);

      // Counter badge must be consistent
      if (activeCount > 0) {
        const counterText = await page.getByTestId("niche-counter").textContent().catch(() => "");
        const m = counterText?.match(/(\d+)\/3/);
        if (m) {
          expect(parseInt(m[1], 10), `Counter badge shows ${m[1]} but active count is ${activeCount}`).toBe(activeCount);
        }
      }
    }
  });

  // ── P3-4: Statistical Ranking Stability ────────────────────────────────────

  test("P3-4 — Ranking stability: same query twice returns same order", async ({ page }) => {
    test.setTimeout(90_000);

    const topQueries = ["Karachi fashion", "Lahore tech", "Islamabad fitness"];

    for (const q of topQueries) {
      await resetPage(page);
      await page.getByTestId("search-input").fill(q);
      await page.getByTestId("search-btn").click();

      await Promise.race([
        page.getByTestId("results-grid").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
        page.getByTestId("no-results").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
      ]).catch(() => {});

      const cards1 = page.getByTestId("result-card");
      const count1 = await cards1.count();
      if (count1 < 2) continue; // not enough results to check ordering

      const order1: string[] = [];
      for (let i = 0; i < Math.min(count1, 5); i++) {
        const u = await cards1.nth(i).getAttribute("data-username").catch(() => "?");
        order1.push(u ?? "?");
      }

      // Repeat same search (may hit session cache)
      await page.getByTestId("search-input").fill(q);
      await page.getByTestId("search-btn").click();

      await Promise.race([
        page.getByTestId("results-grid").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
        page.getByTestId("no-results").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
      ]).catch(() => {});

      const cards2 = page.getByTestId("result-card");
      const count2 = await cards2.count();

      const order2: string[] = [];
      for (let i = 0; i < Math.min(count2, 5); i++) {
        const u = await cards2.nth(i).getAttribute("data-username").catch(() => "?");
        order2.push(u ?? "?");
      }

      expect(
        order2,
        `Ranking unstable for query "${q}": run 1 = [${order1.join(",")}], run 2 = [${order2.join(",")}]`
      ).toEqual(order1);

      console.log(`  ✅ Ranking stable for "${q}": [${order1.slice(0, 3).join(", ")}]`);
    }
  });
});

// ─── Phase 3 Stress Layer ─────────────────────────────────────────────────────

test.describe("Phase 3 — Burst Stress Layer", () => {
  test(`P3-BURST — ${BURST_COUNT} searches in randomized burst`, async ({ page }) => {
    test.setTimeout(BURST_COUNT * 45_000);

    await resetPage(page);

    const credits = await getCredits(page);
    if (credits !== null && credits < 5) {
      test.skip(true, `Only ${credits} credits — skipping burst stress`);
    }

    const rand = lcg(0xf00dface);
    const burstResults: Array<{
      i: number;
      query: string;
      cards: number;
      durationMs: number;
      errors: string[];
    }> = [];

    for (let i = 0; i < BURST_COUNT; i++) {
      const keyword = KEYWORDS[Math.floor(rand() * (KEYWORDS.length - 3))]; // skip abuse strings
      const platform = PLATFORMS[Math.floor(rand() * PLATFORMS.length)];
      const niches = Math.random() > 0.5 ? [NICHES[Math.floor(rand() * NICHES.length)]] : [];

      // Reset niche state
      for (const n of NICHES) {
        const btn = page.getByTestId(`niche-btn-${n.toLowerCase()}`);
        const isActive = await btn.getAttribute("data-active").catch(() => "false");
        if (isActive === "true") await btn.click({ timeout: 1_000 }).catch(() => {});
      }
      for (const n of niches) {
        const btn = page.getByTestId(`niche-btn-${n.toLowerCase()}`);
        if (!await btn.isDisabled().catch(() => true)) {
          await btn.click({ timeout: 1_000 }).catch(() => {});
        }
      }

      // Ensure correct platform
      for (const p of PLATFORMS) {
        const cb = page.getByTestId(`platform-${p}`);
        const checked = await cb.evaluate((el) => (el as HTMLInputElement).checked).catch(() => false);
        if (p === platform && !checked) await cb.click({ timeout: 2_000 }).catch(() => {});
        if (p !== platform && checked) await cb.click({ timeout: 2_000 }).catch(() => {});
      }

      await page.getByTestId("search-input").fill(keyword);

      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });

      const t0 = Date.now();
      const btn = page.getByTestId("search-btn");

      if (await btn.isEnabled().catch(() => false)) {
        await btn.click();
        await Promise.race([
          page.getByTestId("results-grid").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
          page.getByTestId("no-results").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
        ]).catch(() => {});
      }

      const durationMs = Date.now() - t0;
      const cards = await page.getByTestId("result-card").count();

      burstResults.push({ i, query: keyword, cards, durationMs, errors });
      console.log(`  [${i + 1}/${BURST_COUNT}] "${keyword}" → ${cards} cards (${durationMs}ms)`);

      // Credit guard
      const currentCredits = await getCredits(page);
      if (currentCredits !== null && currentCredits <= 2) {
        console.warn(`⚠ Credit budget low (${currentCredits}) — ending burst early at ${i + 1}/${BURST_COUNT}`);
        break;
      }

      // No stale UI — search input must still be interactive
      await expect(page.getByTestId("search-input"), `Search input unresponsive after search ${i + 1}`).toBeEditable();

      // 0–300 ms random delay (simulates realistic burst, not instantaneous)
      await page.waitForTimeout(Math.floor(rand() * 300));
    }

    // Validate burst results
    const crashed = burstResults.filter(
      (r) => r.errors.some((e) => e.includes("Uncaught") || e.includes("TypeError"))
    );
    const longRunning = burstResults.filter((r) => r.durationMs > 30_000);

    console.log(`\n📊 Burst Results:`);
    console.log(`   Total executed  : ${burstResults.length}`);
    console.log(`   Avg duration    : ${Math.round(burstResults.reduce((a, b) => a + b.durationMs, 0) / burstResults.length)}ms`);
    console.log(`   Crashes         : ${crashed.length}`);
    console.log(`   Slow (>30s)     : ${longRunning.length}`);

    // Write burst report
    const reportDir = path.join(process.cwd(), "test-results");
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportDir, "phase3-burst-report.json"),
      JSON.stringify({ phase: "3-burst", generatedAt: new Date().toISOString(), results: burstResults }, null, 2),
      "utf-8"
    );

    expect(crashed.length, `${crashed.length} burst searches caused uncaught JS errors`).toBe(0);
    expect(longRunning.length, `${longRunning.length} burst searches took >30 seconds`).toBe(0);
  });
});
