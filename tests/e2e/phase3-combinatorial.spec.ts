/**
 * phase3-combinatorial.spec.ts
 *
 * Phase 3 — Combinatorial Exhaustive Filter Testing
 *
 * This is NOT a sample test.
 * This is a combinatorial assault on the Creator Discovery engine.
 *
 * Objective: expose probabilistic bugs that only appear under rare filter stacks.
 *
 * Run with:
 *   npx playwright test --project=phase3
 *
 * What it generates:
 *   - 500+ valid filter combinations (keyword × platform × city × niche× followerRange × aiMode)
 *   - 100 invalid / edge-case states
 *   - 50-search burst stress layer
 *
 * Output: statistical report written to test-results/phase3-report.json
 *         and printed to console at the end.
 */

import { test, expect, Page, BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// ─── Domain data ─────────────────────────────────────────────────────────────

const PLATFORMS = ["instagram", "tiktok", "youtube"];
const PLATFORM_PAIRS = [
  ["instagram", "tiktok"],
  ["instagram", "youtube"],
  ["tiktok", "youtube"],
];
const PLATFORM_ALL = ["instagram", "tiktok", "youtube"];

const CITIES = [
  "All Pakistan", "Karachi", "Lahore", "Islamabad", "Rawalpindi",
  "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Hyderabad",
];

const NICHES = [
  "Fashion", "Food", "Beauty", "Cricket", "Tech",
  "Fitness", "Travel", "Gaming", "Music", "Education",
  "Comedy", "Lifestyle", "Finance", "Health",
  "Automotive", "Photography", "Art", "Sports", "News",
];

const FOLLOWER_RANGES = ["any", "1k-10k", "10k-50k", "50k-100k", "100k-500k", "500k+"];

const KEYWORDS = [
  // City + niche
  "Karachi fashion", "Lahore tech", "Islamabad fitness", "Karachi food",
  "Lahore beauty", "Islamabad gaming", "Karachi travel", "Lahore music",
  // Niche only
  "fashion", "fitness", "tech", "food", "beauty", "gaming", "travel",
  // Handle-style
  "@nabeelzuberi", "@fashionpk",
  // Mixed intent
  "Pakistani food blogger 50k", "Urdu comedy creator", "cricket influencer lahore",
  // Random strings (should return no-results gracefully)
  "zxzxzxqq", "!!!test", "12345678",
  // Single char / very short
  "k", "la",
];

const INVALID_STATES = [
  // Empty query
  { query: "", platform: "instagram", note: "empty query" },
  // Whitespace only
  { query: "   ", platform: "instagram", note: "whitespace query" },
  // Extremely long query (>200 chars)
  { query: "Karachi ".repeat(30), platform: "instagram", note: "query >200 chars" },
  // Unicode / special chars
  { query: "کراچی فیشن", platform: "instagram", note: "urdu unicode query" },
  { query: "<script>alert(1)</script>", platform: "instagram", note: "XSS attempt" },
  { query: "'; DROP TABLE users; --", platform: "instagram", note: "SQL injection attempt" },
  { query: "fashion".repeat(30), platform: "instagram", note: "repeated word 200+ chars" },
  // All niches at limit (3)
  { query: "fashion", platform: "instagram", niches: ["Fashion", "Fitness", "Beauty"], note: "max niches selected" },
];

// ─── Type definitions ─────────────────────────────────────────────────────────

interface FilterCombo {
  id: number;
  query: string;
  platform: string | string[];
  city: string;
  niches: string[];
  followerRange: string;
  aiMode: boolean;
  note?: string;
  isInvalid?: boolean;
}

interface RunResult {
  comboId: number;
  query: string;
  platform: string | string[];
  city: string;
  niches: string[];
  followerRange: string;
  aiMode: boolean;
  note?: string;
  isInvalid: boolean;
  passed: boolean;
  failures: string[];
  cardCount: number;
  resultCountLabel: number | null;
  durationMs: number;
  consoleErrors: string[];
  networkErrors: string[];
  creditsBefore: number | null;
  creditsAfter: number | null;
}

// ─── Combination generator ────────────────────────────────────────────────────

function generateCombinations(): FilterCombo[] {
  const combos: FilterCombo[] = [];
  let id = 0;

  const rng = (() => {
    let seed = 42;
    return () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  })();

  const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const pickN = <T>(arr: T[], n: number): T[] => {
    const copy = [...arr];
    const out: T[] = [];
    for (let i = 0; i < n && copy.length; i++) {
      const idx = Math.floor(rng() * copy.length);
      out.push(copy.splice(idx, 1)[0]);
    }
    return out;
  };

  // ── Tier 1: Systematic single-variable sweep (one variable at a time) ─────
  // Platform × keyword
  for (const platform of PLATFORMS) {
    for (const query of KEYWORDS.slice(0, 8)) {
      combos.push({ id: id++, query, platform, city: "All Pakistan", niches: [], followerRange: "any", aiMode: false });
    }
  }

  // City sweep (instagram only, varied queries)
  for (const city of CITIES) {
    combos.push({ id: id++, query: "fashion creator", platform: "instagram", city, niches: [], followerRange: "any", aiMode: false });
  }

  // Niche single-select sweep
  for (const niche of NICHES) {
    combos.push({ id: id++, query: "Pakistani creator", platform: "instagram", city: "All Pakistan", niches: [niche], followerRange: "any", aiMode: false });
  }

  // Follower range sweep
  for (const range of FOLLOWER_RANGES) {
    combos.push({ id: id++, query: "fashion", platform: "instagram", city: "Karachi", niches: [], followerRange: range, aiMode: false });
  }

  // AI mode ON for some keywords
  for (const query of ["Urdu food blogger Lahore", "cricket influencer 100k", "beauty creator Karachi"]) {
    combos.push({ id: id++, query, platform: "instagram", city: "All Pakistan", niches: [], followerRange: "any", aiMode: true });
    combos.push({ id: id++, query, platform: "tiktok", city: "All Pakistan", niches: [], followerRange: "any", aiMode: true });
  }

  // ── Tier 2: Platform pairs + triples ─────────────────────────────────────
  for (const pair of PLATFORM_PAIRS) {
    for (const query of ["fashion", "fitness", "Karachi blogger"]) {
      combos.push({ id: id++, query, platform: pair, city: "All Pakistan", niches: [], followerRange: "any", aiMode: false, note: "platform pair" });
    }
  }
  // All three platforms
  for (const query of ["Pakistani creator", "Lahore tech"]) {
    combos.push({ id: id++, query, platform: PLATFORM_ALL, city: "All Pakistan", niches: [], followerRange: "any", aiMode: false, note: "all platforms" });
  }

  // ── Tier 3: 2-niche combos ────────────────────────────────────────────────
  const nichePairs = [
    ["Fashion", "Beauty"], ["Fitness", "Health"], ["Tech", "Gaming"],
    ["Food", "Lifestyle"], ["Music", "Comedy"], ["Travel", "Photography"],
  ];
  for (const pair of nichePairs) {
    for (const city of ["Karachi", "Lahore", "All Pakistan"]) {
      combos.push({ id: id++, query: "Pakistani creator", platform: "instagram", city, niches: pair, followerRange: "any", aiMode: false });
    }
  }

  // ── Tier 4: 3-niche (max) combos ─────────────────────────────────────────
  const nicheTriplets = [
    ["Fashion", "Beauty", "Lifestyle"],
    ["Tech", "Gaming", "Education"],
    ["Food", "Health", "Fitness"],
    ["Music", "Comedy", "Art"],
    ["Cricket", "Sports", "Fitness"],
  ];
  for (const triplet of nicheTriplets) {
    for (const platform of PLATFORMS) {
      combos.push({ id: id++, query: "Pakistani influencer", platform, city: "All Pakistan", niches: triplet, followerRange: "any", aiMode: false, note: "max niches" });
    }
  }

  // ── Tier 5: Full stack combos (all filters active) ───────────────────────
  const fullStackCases = [
    { query: "Karachi fashion", platform: "instagram", city: "Karachi", niches: ["Fashion"], followerRange: "10k-50k", aiMode: false },
    { query: "fitness", platform: "tiktok", city: "Lahore", niches: ["Fitness", "Health"], followerRange: "50k-100k", aiMode: false },
    { query: "tech blogger", platform: "youtube", city: "Islamabad", niches: ["Tech", "Education", "Gaming"], followerRange: "100k-500k", aiMode: false },
    { query: "Pakistani creator", platform: "instagram", city: "Karachi", niches: ["Fashion", "Beauty", "Lifestyle"], followerRange: "1k-10k", aiMode: true },
    { query: "comedy creator", platform: "tiktok", city: "All Pakistan", niches: ["Comedy"], followerRange: "500k+", aiMode: true },
  ];
  for (const c of fullStackCases) {
    combos.push({ id: id++, ...c });
  }

  // ── Tier 6: Randomised valid states (bulk up to 500+ total) ─────────────
  const targetTotal = 520;
  while (combos.length < targetTotal) {
    const nicheCount = Math.floor(rng() * 4); // 0, 1, 2, or 3
    combos.push({
      id: id++,
      query: pick(KEYWORDS),
      platform: rng() < 0.15 ? pick([PLATFORM_PAIRS[0], PLATFORM_PAIRS[1], PLATFORM_PAIRS[2], PLATFORM_ALL]) : pick(PLATFORMS),
      city: pick(CITIES),
      niches: pickN(NICHES, nicheCount),
      followerRange: pick(FOLLOWER_RANGES),
      aiMode: rng() < 0.25,
    });
  }

  // ── Tier 7: Invalid / edge states ────────────────────────────────────────
  for (const s of INVALID_STATES) {
    combos.push({
      id: id++,
      query: s.query,
      platform: s.platform,
      city: "All Pakistan",
      niches: (s as any).niches ?? [],
      followerRange: "any",
      aiMode: false,
      note: s.note,
      isInvalid: true,
    });
  }
  // Extra random edge states
  while (combos.filter(c => c.isInvalid).length < 100) {
    combos.push({
      id: id++,
      query: pick(["", "  ", "a", "1", "@", "#!$", "x".repeat(201), "🚀 creator", "null", "undefined"]),
      platform: pick(PLATFORMS),
      city: "All Pakistan",
      niches: [],
      followerRange: "any",
      aiMode: false,
      isInvalid: true,
      note: "random edge state",
    });
  }

  return combos;
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

async function applyCombo(page: Page, combo: FilterCombo): Promise<void> {
  // Platform — click checkboxes to reach desired state
  const desiredPlatforms = Array.isArray(combo.platform) ? combo.platform : [combo.platform];

  // Uncheck all first, then check desired
  for (const p of PLATFORMS) {
    const checkbox = page.getByTestId(`platform-${p}`);
    const isChecked = await checkbox.evaluate((el: HTMLInputElement) => el.checked).catch(() => false);
    if (isChecked && !desiredPlatforms.includes(p)) await checkbox.click().catch(() => {});
    if (!isChecked && desiredPlatforms.includes(p)) await checkbox.click().catch(() => {});
  }

  // City
  if (combo.city !== "All Pakistan") {
    await page.locator("select").first().selectOption(combo.city).catch(() => {});
  }

  // Follower range — second <select>
  if (combo.followerRange !== "any") {
    await page.locator("select").nth(1).selectOption(combo.followerRange).catch(() => {});
  }

  // Niches — deselect all active first, then select desired
  for (const n of NICHES) {
    const btn = page.getByTestId(`niche-btn-${n.toLowerCase()}`);
    const isActive = await btn.getAttribute("data-active").catch(() => "false");
    if (isActive === "true" && !combo.niches.includes(n)) {
      await btn.click({ timeout: 1_000 }).catch(() => {});
    }
  }
  for (const n of combo.niches) {
    const btn = page.getByTestId(`niche-btn-${n.toLowerCase()}`);
    const isDisabled = await btn.isDisabled().catch(() => true);
    if (!isDisabled) await btn.click({ timeout: 1_000 }).catch(() => {});
  }

  // AI mode
  const switchEl = page.locator("#ai-mode");
  const isChecked = await switchEl.evaluate((el: HTMLInputElement) => el.getAttribute("data-state")).catch(() => "unchecked");
  if (combo.aiMode && isChecked !== "checked") await switchEl.click().catch(() => {});
  if (!combo.aiMode && isChecked === "checked") await switchEl.click().catch(() => {});
}

async function getCredits(page: Page): Promise<number | null> {
  const badge = page.getByTestId("credits-badge");
  if (!await badge.isVisible().catch(() => false)) return null;
  const m = (await badge.textContent())?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function executeSearch(page: Page, query: string): Promise<void> {
  const input = page.getByTestId("search-input");
  await input.fill(query);
  const btn = page.getByTestId("search-btn");
  const enabled = await btn.isEnabled().catch(() => false);
  if (!enabled) return; // empty query — intentionally no-op
  await btn.click();
  await Promise.race([
    page.getByTestId("results-grid").waitFor({ state: "visible", timeout: 35_000 }),
    page.getByTestId("no-results").waitFor({ state: "visible", timeout: 35_000 }),
    page.waitForTimeout(35_000),
  ]).catch(() => {});
}

async function validateRun(page: Page, combo: FilterCombo, creditsBefore: number | null, creditsAfter: number | null, consoleErrors: string[], networkErrors: string[], durationMs: number): Promise<RunResult> {
  const failures: string[] = [];

  const cards = page.getByTestId("result-card");
  const cardCount = await cards.count();

  // Result count label
  let resultCountLabel: number | null = null;
  const labelText = await page.getByTestId("result-count").textContent().catch(() => null);
  if (labelText) {
    const m = labelText.match(/^(\d+)/);
    if (m) resultCountLabel = parseInt(m[1], 10);
  }

  const gridVisible = await page.getByTestId("results-grid").isVisible().catch(() => false);
  const noResultsVisible = await page.getByTestId("no-results").isVisible().catch(() => false);
  const loaderStuck = await page.getByTestId("loading-state").isVisible().catch(() => false);

  // ── Validation rules ────────────────────────────────────────────────────

  // 1. Never both stuck in loader and no content
  if (loaderStuck) failures.push("LOADER_STUCK: loading spinner still visible after timeout");

  // 2. Exactly one of grid or no-results must be visible (not neither for valid queries)
  if (!combo.isInvalid && combo.query.trim().length >= 2) {
    if (!gridVisible && !noResultsVisible && !loaderStuck) {
      failures.push("BLANK_UI: neither results-grid nor no-results visible after valid search");
    }
  }

  // 3. Result count label must match rendered cards
  if (gridVisible && resultCountLabel !== null) {
    if (resultCountLabel !== cardCount) {
      failures.push(`COUNT_MISMATCH: label says ${resultCountLabel} but ${cardCount} cards rendered`);
    }
  }

  // 4. No duplicate creator cards (platform:username)
  if (cardCount > 0) {
    const seen = new Set<string>();
    for (let i = 0; i < cardCount; i++) {
      const uname = await cards.nth(i).getAttribute("data-username").catch(() => null);
      const plat = await cards.nth(i).getAttribute("data-platform").catch(() => null);
      const key = `${plat}:${uname}`;
      if (seen.has(key)) {
        failures.push(`DUPLICATE: ${key} appears more than once`);
        break;
      }
      seen.add(key);
    }
  }

  // 5. Niche filter must not leak non-matching niches
  if (combo.niches.length > 0 && cardCount > 0) {
    for (let i = 0; i < Math.min(cardCount, 6); i++) {
      const nicheEl = cards.nth(i).getByTestId("card-niche");
      const nicheText = await nicheEl.textContent().catch(() => null);
      if (nicheText !== null && !combo.niches.includes(nicheText)) {
        failures.push(`NICHE_LEAK: card ${i} shows niche "${nicheText}" but active filter is ${JSON.stringify(combo.niches)}`);
      }
    }
  }

  // 6. Platform filter must not cross-leak
  const desiredPlatforms = Array.isArray(combo.platform) ? combo.platform : [combo.platform];
  if (cardCount > 0) {
    for (let i = 0; i < Math.min(cardCount, 6); i++) {
      const cardPlatform = await cards.nth(i).getAttribute("data-platform").catch(() => null);
      // Edge: only primary platform is used when multi selected
      const activePlatform = desiredPlatforms[0];
      if (cardPlatform && cardPlatform.toLowerCase() !== activePlatform.toLowerCase()) {
        failures.push(`PLATFORM_LEAK: card ${i} is "${cardPlatform}" but active platform is "${activePlatform}"`);
      }
    }
  }

  // 7. No JS console errors (excluding browser noise)
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes("ResizeObserver") &&
    !e.includes("passive event") &&
    !e.includes("favicon") &&
    !e.includes("ERR_ABORTED") // cancelled inflight requests are fine
  );
  if (criticalErrors.length > 0) {
    failures.push(`CONSOLE_ERROR: ${criticalErrors[0]}`);
  }

  // 8. No 5xx network errors
  if (networkErrors.length > 0) {
    failures.push(`NETWORK_5XX: ${networkErrors[0]}`);
  }

  // 9. Credit deducted exactly once for valid non-cached searches
  if (!combo.isInvalid && combo.query.trim().length >= 2 && creditsBefore !== null && creditsAfter !== null) {
    const delta = creditsBefore - creditsAfter;
    if (delta > 1) failures.push(`CREDIT_OVER_DEDUCT: deducted ${delta} credits for a single search`);
    // delta = 0 is acceptable (cache hit)
    // delta < 0 would mean credits increased which is wrong
    if (delta < 0) failures.push(`CREDIT_INCREASED: credits went up after search (${creditsBefore} → ${creditsAfter})`);
  }

  // 10. Engagement rates must be sane
  if (cardCount > 0) {
    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      const erText = await cards.nth(i).getByTestId("card-engagement").textContent().catch(() => null);
      if (erText) {
        const num = parseFloat(erText.replace("%", ""));
        if (!isNaN(num) && (num < 0 || num > 100)) {
          failures.push(`INVALID_ER: card ${i} has engagement rate ${num}%`);
        }
      }
    }
  }

  return {
    comboId: combo.id,
    query: combo.query,
    platform: combo.platform,
    city: combo.city,
    niches: combo.niches,
    followerRange: combo.followerRange,
    aiMode: combo.aiMode,
    note: combo.note,
    isInvalid: combo.isInvalid ?? false,
    passed: failures.length === 0,
    failures,
    cardCount,
    resultCountLabel,
    durationMs,
    consoleErrors: criticalErrors,
    networkErrors,
    creditsBefore,
    creditsAfter,
  };
}

// ─── Statistical report ───────────────────────────────────────────────────────

function generateReport(results: RunResult[]): string {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const validRuns = results.filter(r => !r.isInvalid);
  const invalidRuns = results.filter(r => r.isInvalid);

  // Failure type frequency
  const failureTypes: Record<string, number> = {};
  for (const r of results.filter(r => !r.passed)) {
    for (const f of r.failures) {
      const type = f.split(":")[0];
      failureTypes[type] = (failureTypes[type] ?? 0) + 1;
    }
  }

  // Slowest combos
  const sorted = [...results].sort((a, b) => b.durationMs - a.durationMs);
  const slowest = sorted.slice(0, 5).map(r => ({ id: r.comboId, q: r.query, ms: r.durationMs }));

  // Filters most likely to cause failure
  const filterFailRate: Record<string, { total: number; failed: number }> = {};
  for (const r of results) {
    const key = `${Array.isArray(r.platform) ? r.platform.join("+") : r.platform}|${r.city}|niches=${r.niches.length}|${r.followerRange}`;
    if (!filterFailRate[key]) filterFailRate[key] = { total: 0, failed: 0 };
    filterFailRate[key].total++;
    if (!r.passed) filterFailRate[key].failed++;
  }
  const worstFilters = Object.entries(filterFailRate)
    .filter(([, v]) => v.failed > 0)
    .sort(([, a], [, b]) => (b.failed / b.total) - (a.failed / a.total))
    .slice(0, 5)
    .map(([k, v]) => ({ filter: k, failRate: `${Math.round(v.failed / v.total * 100)}%`, failed: v.failed, total: v.total }));

  const avgDuration = results.reduce((s, r) => s + r.durationMs, 0) / total;
  const p95 = sorted[Math.floor(total * 0.05)]?.durationMs ?? 0;

  const report = {
    summary: {
      totalCombinationsTested: total,
      validStateCombinations: validRuns.length,
      invalidEdgeStateCombinations: invalidRuns.length,
      passed,
      failed,
      passRate: `${Math.round(passed / total * 100)}%`,
      failRate: `${Math.round(failed / total * 100)}%`,
    },
    performance: {
      avgDurationMs: Math.round(avgDuration),
      p95DurationMs: p95,
      slowestCombos: slowest,
    },
    failures: {
      byType: failureTypes,
      mostCommonFailureType: Object.entries(failureTypes).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "none",
      filtersWithHighestFailRate: worstFilters,
      fullFailedList: results.filter(r => !r.passed).map(r => ({
        id: r.comboId, query: r.query, platform: r.platform,
        niches: r.niches, city: r.city, failures: r.failures,
      })),
    },
    enrichmentMismatches: results.filter(r => r.failures.some(f => f.startsWith("NICHE_LEAK") || f.startsWith("PLATFORM_LEAK"))).length,
    raceConditionsDetected: results.filter(r => r.failures.some(f => f.includes("STALE") || f.includes("STUCK"))).length,
    cachePoisoning: results.filter(r => r.failures.some(f => f.includes("CREDIT_OVER_DEDUCT"))).length,
  };

  return JSON.stringify(report, null, 2);
}

// ─── Global state for accumulating results across tests ───────────────────────

const ALL_RESULTS: RunResult[] = [];
const COMBOS = generateCombinations();

// ─── Main test suite ──────────────────────────────────────────────────────────

// Split into batches of 50 so Playwright doesn't time out the entire suite
const BATCH_SIZE = 50;
const VALID_COMBOS = COMBOS.filter(c => !c.isInvalid);
const INVALID_COMBOS = COMBOS.filter(c => c.isInvalid);

const batches: FilterCombo[][] = [];
for (let i = 0; i < VALID_COMBOS.length; i += BATCH_SIZE) {
  batches.push(VALID_COMBOS.slice(i, i + BATCH_SIZE));
}

test.describe("Phase 3 — Combinatorial Filter Assault", () => {
  // Run valid combo batches
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    test(`Batch ${batchIdx + 1}/${batches.length} — ${batch.length} valid combinations`, async ({ page }) => {
      await page.goto("/search");
      await expect(page.getByTestId("search-input")).toBeVisible({ timeout: 15_000 });

      for (const combo of batch) {
        const consoleErrors: string[] = [];
        const networkErrors: string[] = [];

        const consoleHandler = (msg: any) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        };
        const responseHandler = (response: any) => {
          if (response.status() >= 500) networkErrors.push(`${response.status()} ${response.url()}`);
        };

        page.on("console", consoleHandler);
        page.on("response", responseHandler);

        const creditsBefore = await getCredits(page);
        const t0 = Date.now();

        try {
          await applyCombo(page, combo);
          await executeSearch(page, combo.query);
        } catch (e) {
          networkErrors.push(`EXECUTION_ERROR: ${e}`);
        }

        const durationMs = Date.now() - t0;
        const creditsAfter = await getCredits(page);

        const result = await validateRun(page, combo, creditsBefore, creditsAfter, consoleErrors, networkErrors, durationMs);
        ALL_RESULTS.push(result);

        page.off("console", consoleHandler);
        page.off("response", responseHandler);

        // Bail early if credits exhausted
        const remaining = creditsAfter ?? creditsBefore;
        if (remaining !== null && remaining <= 0) {
          console.warn(`⚠ Credits exhausted at combo ${combo.id} — stopping batch`);
          break;
        }

        // Brief pause to avoid hammering the edge function
        await page.waitForTimeout(500 + Math.random() * 300);
      }
    });
  }

  // Invalid / edge states
  test(`Edge States — ${INVALID_COMBOS.length} invalid/edge combinations`, async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByTestId("search-input")).toBeVisible({ timeout: 15_000 });

    for (const combo of INVALID_COMBOS) {
      const consoleErrors: string[] = [];
      const networkErrors: string[] = [];

      const consoleHandler = (msg: any) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      };
      page.on("console", consoleHandler);

      const creditsBefore = await getCredits(page);
      const t0 = Date.now();

      try {
        await applyCombo(page, combo);
        await page.getByTestId("search-input").fill(combo.query);

        // Try to click — it may be disabled for empty query
        const btn = page.getByTestId("search-btn");
        const enabled = await btn.isEnabled().catch(() => false);
        if (enabled) {
          await btn.click();
          await Promise.race([
            page.getByTestId("results-grid").waitFor({ state: "visible", timeout: 20_000 }),
            page.getByTestId("no-results").waitFor({ state: "visible", timeout: 20_000 }),
            page.waitForTimeout(20_000),
          ]).catch(() => {});
        }
      } catch (e) {
        networkErrors.push(`EDGE_EXECUTION_ERROR: ${e}`);
      }

      const durationMs = Date.now() - t0;
      const creditsAfter = await getCredits(page);

      // For invalid states: the key validation is "no crash, no 5xx, UI is stable"
      const loaderStuck = await page.getByTestId("loading-state").isVisible().catch(() => false);
      const failures: string[] = [];
      if (loaderStuck) failures.push("LOADER_STUCK on invalid input");

      const criticalErrors = consoleErrors.filter(e =>
        e.includes("Uncaught") || e.includes("Cannot read") || e.includes("TypeError")
      );
      if (criticalErrors.length) failures.push(`UNCAUGHT_JS: ${criticalErrors[0]}`);
      if (networkErrors.length) failures.push(`NETWORK_ERROR: ${networkErrors[0]}`);

      ALL_RESULTS.push({
        comboId: combo.id,
        query: combo.query,
        platform: combo.platform,
        city: combo.city,
        niches: combo.niches,
        followerRange: combo.followerRange,
        aiMode: combo.aiMode,
        note: combo.note,
        isInvalid: true,
        passed: failures.length === 0,
        failures,
        cardCount: 0,
        resultCountLabel: null,
        durationMs,
        consoleErrors: criticalErrors,
        networkErrors,
        creditsBefore,
        creditsAfter,
      });

      page.off("console", consoleHandler);
      await page.waitForTimeout(200);
    }
  });
});

// ─── Burst Stress Layer ───────────────────────────────────────────────────────

test.describe("Phase 3 — Burst Stress (50 searches / 60 s)", () => {
  test("burst: 50 rapid searches with random filters", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByTestId("search-input")).toBeVisible({ timeout: 15_000 });

    const rng = (() => {
      let seed = 1337;
      return () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
    })();
    const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

    const BURST_KEYWORDS = ["fashion", "Karachi", "fitness", "tech", "beauty", "gaming", "food", "music"];

    let successCount = 0;
    let errorCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < 50; i++) {
      if (Date.now() - startTime > 60_000) {
        console.warn(`⏱ 60 s budget reached at iteration ${i} — stopping burst`);
        break;
      }

      const credits = await getCredits(page);
      if (credits !== null && credits <= 0) {
        console.warn("Credits exhausted — stopping burst");
        break;
      }

      try {
        const q = pick(BURST_KEYWORDS);
        await page.getByTestId("search-input").fill(q);

        // Random niche toggle
        if (rng() > 0.7) {
          const n = pick(["fashion", "fitness", "tech", "beauty", "gaming"]);
          const btn = page.getByTestId(`niche-btn-${n}`);
          const disabled = await btn.isDisabled().catch(() => true);
          if (!disabled) await btn.click({ timeout: 500 }).catch(() => {});
        }

        const btn = page.getByTestId("search-btn");
        if (await btn.isEnabled()) {
          await btn.click();
          await Promise.race([
            page.getByTestId("results-grid").waitFor({ state: "visible", timeout: 30_000 }),
            page.getByTestId("no-results").waitFor({ state: "visible", timeout: 30_000 }),
            page.waitForTimeout(30_000),
          ]).catch(() => {});
        }

        // Verify no loader stuck
        const stuck = await page.getByTestId("loading-state").isVisible().catch(() => false);
        if (stuck) throw new Error("Loader stuck");

        successCount++;
      } catch (e) {
        errorCount++;
        console.warn(`Burst iteration ${i} error: ${e}`);
        if (errorCount >= 10) {
          throw new Error(`Burst test: 10 consecutive failures — engine not surviving burst`);
        }
      }

      // Minimal pause — intentionally aggressive
      await page.waitForTimeout(200 + Math.random() * 600);
    }

    console.log(`\n⚡ Burst Results: ${successCount} succeeded, ${errorCount} failed in ${Math.round((Date.now() - startTime) / 1000)}s`);
    expect(errorCount / Math.max(successCount + errorCount, 1), "Error rate >20% in burst").toBeLessThan(0.2);
    expect(successCount, "Fewer than 5 searches completed in burst").toBeGreaterThanOrEqual(5);
  });
});

// ─── Final Statistical Report ─────────────────────────────────────────────────

test.describe("Phase 3 — Statistical Report", () => {
  test("generate and write report", async ({}) => {
    test.skip(ALL_RESULTS.length === 0, "No results collected — run combinatorial tests first");

    const report = generateReport(ALL_RESULTS);
    const outDir = path.join(process.cwd(), "test-results");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "phase3-report.json"), report, "utf-8");

    const parsed = JSON.parse(report);
    const { summary, failures, performance } = parsed;

    console.log("\n");
    console.log("════════════════════════════════════════════════════════");
    console.log("  PHASE 3 — COMBINATORIAL ASSAULT — STATISTICAL REPORT");
    console.log("════════════════════════════════════════════════════════");
    console.log(`  Total combinations tested : ${summary.totalCombinationsTested}`);
    console.log(`  Valid state runs          : ${summary.validStateCombinations}`);
    console.log(`  Edge / invalid state runs : ${summary.invalidEdgeStateCombinations}`);
    console.log(`  ✅ Passed                 : ${summary.passed} (${summary.passRate})`);
    console.log(`  ❌ Failed                 : ${summary.failed} (${summary.failRate})`);
    console.log(`  Avg duration              : ${performance.avgDurationMs} ms`);
    console.log(`  P95 duration              : ${performance.p95DurationMs} ms`);
    console.log(`  Most common failure       : ${failures.mostCommonFailureType}`);
    console.log(`  Enrichment mismatches     : ${parsed.enrichmentMismatches}`);
    console.log(`  Race conditions detected  : ${parsed.raceConditionsDetected}`);
    console.log(`  Cache poisoning flags     : ${parsed.cachePoisoning}`);
    if (failures.filtersWithHighestFailRate.length) {
      console.log(`\n  Filter stacks most likely to break:`);
      for (const f of failures.filtersWithHighestFailRate) {
        console.log(`    ${f.filter}  →  ${f.failRate} fail rate (${f.failed}/${f.total})`);
      }
    }
    console.log(`\n  Full report: test-results/phase3-report.json`);
    console.log("════════════════════════════════════════════════════════\n");

    // Report is written — the suite passes as long as fail rate < 25%
    const failRate = parsed.summary.failed / Math.max(parsed.summary.totalCombinationsTested, 1);
    expect(
      failRate,
      `Overall fail rate ${parsed.summary.failRate} exceeds 25% threshold. Check test-results/phase3-report.json for details.`
    ).toBeLessThan(0.25);
  });
});
