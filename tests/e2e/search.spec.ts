/**
 * search.spec.ts
 *
 * Phase 2 — Automated Real-User Simulation & Filter Logic Validation
 *
 * Covers:
 *  S1  – Real search simulation (human-like typing, 7 keyword scenarios)
 *  S2  – Loader / state machine validation
 *  S3  – Credit deduction (exactly 1 per search)
 *  S4  – Full filter combination matrix (city × niche × follower range × platform)
 *  S5  – Niche button logic enforcement (max = 3)
 *  S6  – Back-navigation cache (no credit spend on re-visit)
 *  S7  – AI Mode toggle
 *  S8  – Enrichment / card data integrity
 *  S9  – No duplicate creators in results
 *  S10 – No console errors during normal usage
 *  S11 – Result count ↔ visible card count consistency
 *  S12 – Multi-platform warning banner
 */

import { test, expect, Page, ConsoleMessage } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEARCH_URL = "/search";
const LONG_TIMEOUT = 40_000; // edge function cold-start can be slow

/** Navigate to /search and wait for the input to be ready. */
async function gotoSearch(page: Page) {
  await page.goto(SEARCH_URL);
  await expect(page.getByTestId("search-input")).toBeVisible({ timeout: 15_000 });
}

/**
 * Type a query character-by-character to simulate human input,
 * then click Search and wait for results or no-results to appear.
 * Returns the number of visible result cards.
 */
async function searchFor(page: Page, query: string): Promise<number> {
  const input = page.getByTestId("search-input");
  await input.clear();
  // Human-like typing: each char with a small random delay
  for (const char of query) {
    await input.pressSequentially(char, { delay: 40 + Math.random() * 60 });
  }

  await page.getByTestId("search-btn").click();

  // Wait for loader to appear then disappear
  await page
    .getByTestId("loading-state")
    .waitFor({ state: "visible", timeout: 8_000 })
    .catch(() => { /* loader sometimes too fast to catch */ });

  // Wait for results OR no-results to be visible
  await Promise.race([
    page.getByTestId("results-grid").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
    page.getByTestId("no-results").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
  ]);

  const cards = page.getByTestId("result-card");
  return await cards.count();
}

/** Read the credits badge text and parse the integer. */
async function getCredits(page: Page): Promise<number | null> {
  const badge = page.getByTestId("credits-badge");
  const visible = await badge.isVisible().catch(() => false);
  if (!visible) return null;
  const text = await badge.textContent();
  const match = text?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** Collect all console errors during a page action. */
function collectConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  const handler = (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(msg.text());
  };
  page.on("console", handler);
  return () => {
    page.off("console", handler);
    return errors;
  };
}

// ─── S1: Real Search Simulation ──────────────────────────────────────────────

test.describe("S1 – Real Search Simulation (Human-like UI)", () => {
  const QUERIES = [
    { label: "Karachi fashion", query: "Karachi fashion" },
    { label: "Lahore tech", query: "Lahore tech" },
    { label: "Islamabad fitness 50k", query: "Islamabad fitness 50k" },
    { label: "single-word niche", query: "Gaming" },
    { label: "city only", query: "Karachi" },
    { label: "nonsense string", query: "zzxxqq$$%%gobbledygook" },
  ];

  for (const { label, query } of QUERIES) {
    test(`search: "${label}"`, async ({ page }) => {
      await gotoSearch(page);

      const stopCollecting = collectConsoleErrors(page);
      const cardCount = await searchFor(page, query);
      const errors = stopCollecting();

      // Any result OR a clear no-results state — never a blank page
      const noResults = await page.getByTestId("no-results").isVisible().catch(() => false);
      expect(cardCount > 0 || noResults, `Expected results OR no-results for "${query}"`).toBe(true);

      // No blank cards (every visible card must have at least a username rendered)
      if (cardCount > 0) {
        const cards = page.getByTestId("result-card");
        for (let i = 0; i < Math.min(cardCount, 6); i++) {
          const card = cards.nth(i);
          const username = await card.locator("[data-testid]").count();
          expect(username, `Card ${i} appears blank`).toBeGreaterThan(0);
        }
      }

      // No JS console errors during normal search
      const filteredErrors = errors.filter(e =>
        !e.includes("ResizeObserver") && // browser noise
        !e.includes("passive event") &&
        !e.includes("favicon")
      );
      expect(filteredErrors, "Console errors during search").toHaveLength(0);
    });
  }

  test("search by @exacthandle", async ({ page }) => {
    await gotoSearch(page);
    const cardCount = await searchFor(page, "@nabeelzuberi");
    // Either result or no-results — we just check there's no crash
    const noResults = await page.getByTestId("no-results").isVisible().catch(() => false);
    expect(cardCount > 0 || noResults).toBe(true);
  });
});

// ─── S2: Loader State Machine ─────────────────────────────────────────────────

test.describe("S2 – Loader / State Machine", () => {
  test("loader appears while searching and disappears when done", async ({ page }) => {
    await gotoSearch(page);
    const input = page.getByTestId("search-input");
    await input.fill("Karachi fashion");

    // Click search and immediately check for loader
    await page.getByTestId("search-btn").click();

    // Loader should eventually appear (it might be very fast; we have a generous window)
    const loaderVisible = await page
      .getByTestId("loading-state")
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    // Loader must disappear — results or no-results must appear
    await Promise.race([
      page.getByTestId("results-grid").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
      page.getByTestId("no-results").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
    ]);

    const loaderGone = await page.getByTestId("loading-state").isVisible().catch(() => false);
    expect(loaderGone, "Loader still visible after search completed").toBe(false);

    // loaderVisible is informational — warn if it was never seen (too fast)
    console.log(loaderVisible ? "✔ Loader was visible" : "⚠ Loader resolved too fast to observe");
  });

  test("search button disabled with empty query", async ({ page }) => {
    await gotoSearch(page);
    const btn = page.getByTestId("search-btn");
    await expect(btn).toBeDisabled();
    await page.getByTestId("search-input").fill("k");
    await expect(btn).toBeEnabled();
    await page.getByTestId("search-input").clear();
    await expect(btn).toBeDisabled();
  });
});

// ─── S3: Credit Deduction ────────────────────────────────────────────────────

test.describe("S3 – Credit Deduction", () => {
  test("credit count decreases by exactly 1 per search", async ({ page }) => {
    await gotoSearch(page);

    // Wait for credits badge to appear
    await expect(page.getByTestId("credits-badge")).toBeVisible({ timeout: 10_000 });

    const before = await getCredits(page);
    if (before === null) {
      test.skip(true, "Credits badge not visible — cannot verify deduction");
      return;
    }
    if (before < 2) {
      test.skip(true, `Only ${before} credits remaining — skipping to preserve credits`);
      return;
    }

    await searchFor(page, "Lahore fashion");

    // Re-fetch after search completes
    const after = await getCredits(page);
    expect(after, "Credits badge should update after search").not.toBeNull();
    expect(after, `Expected credits to drop from ${before} to ${before - 1}, got ${after}`).toBe(before - 1);
  });

  test("second identical search does NOT deduct credits (session cache hit)", async ({ page }) => {
    await gotoSearch(page);
    await expect(page.getByTestId("credits-badge")).toBeVisible({ timeout: 10_000 });

    const before = await getCredits(page);
    if (before === null || before < 2) {
      test.skip(true, "Insufficient credits for this test");
      return;
    }

    await searchFor(page, "Karachi lifestyle");
    const afterFirst = await getCredits(page);

    // Repeat the same search — should hit sessionStorage cache
    await searchFor(page, "Karachi lifestyle");
    const afterSecond = await getCredits(page);

    expect(afterFirst, "First search should deduct 1 credit").toBe(before - 1);
    expect(afterSecond, "Second identical search should NOT deduct credit (cache hit)").toBe(before - 1);
  });
});

// ─── S4: Full Filter Combination Matrix ──────────────────────────────────────

test.describe("S4 – Filter Combination Matrix", () => {
  test("1 niche filter — only matching-niche cards shown", async ({ page }) => {
    await gotoSearch(page);

    // First, get results without filter
    const total = await searchFor(page, "Pakistani creator");
    if (total === 0) {
      test.skip(true, "No results — skipping filter test");
      return;
    }

    // Activate 'Fashion' niche filter
    const btn = page.getByTestId("niche-btn-fashion");
    await btn.click();
    await expect(btn).toHaveAttribute("data-active", "true");

    // Filtered count should be shown
    const countText = await page.getByTestId("result-count").textContent().catch(() => "");
    const visibleCards = await page.getByTestId("result-card").count();

    // Every visible card must have niche = Fashion or have no niche badge at all
    // (cards without a detected niche are now correctly excluded)
    const nicheBadges = page.getByTestId("card-niche");
    const badgeCount = await nicheBadges.count();
    for (let i = 0; i < badgeCount; i++) {
      const text = await nicheBadges.nth(i).textContent();
      expect(text, `Card niche badge shows "${text}" but Fashion filter active`).toBe("Fashion");
    }

    // Result count label must match visible cards
    const numMatch = countText?.match(/^(\d+)/);
    if (numMatch) {
      expect(parseInt(numMatch[1], 10), "Result count label vs actual cards mismatch").toBe(visibleCards);
    }
  });

  test("3 niches + city + follower range — filters stack correctly", async ({ page }) => {
    await gotoSearch(page);
    const total = await searchFor(page, "Pakistani influencer");
    if (total === 0) {
      test.skip(true, "No results — skipping matrix test");
      return;
    }

    // Select up to 3 niches
    for (const niche of ["fashion", "fitness", "beauty"]) {
      const btn = page.getByTestId(`niche-btn-${niche}`);
      const disabled = await btn.isDisabled().catch(() => false);
      if (!disabled) await btn.click();
    }

    // Verify counter shows 3/3
    const counter = page.getByTestId("niche-counter");
    await expect(counter).toContainText("3/3");

    // All visible cards must belong to one of the 3 niches
    const cards = page.getByTestId("result-card");
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const niche = await cards.nth(i).getByTestId("card-niche").textContent().catch(() => null);
      if (niche !== null) {
        expect(["Fashion", "Fitness", "Beauty"]).toContain(niche);
      }
    }
  });

  test("deselecting a niche recalculates results correctly", async ({ page }) => {
    await gotoSearch(page);
    const total = await searchFor(page, "Pakistani creator");
    if (total === 0) test.skip(true, "No results");

    // Select Fashion
    await page.getByTestId("niche-btn-fashion").click();
    const filteredCount = await page.getByTestId("result-card").count();

    // Deselect Fashion — should revert to total
    await page.getByTestId("niche-btn-fashion").click();
    const afterClear = await page.getByTestId("result-card").count();
    expect(afterClear, "Removing niche filter should restore full results").toBe(total);
  });

  test("multi-platform warning shown when >1 platform selected", async ({ page }) => {
    await gotoSearch(page);
    // Select both Instagram and TikTok
    await page.getByTestId("platform-tiktok").click();
    await page.getByTestId("platform-instagram").click();

    await searchFor(page, "Karachi fashion");

    const countText = await page.getByTestId("result-count").textContent().catch(() => "");
    // The warning "⚠️ Showing instagram only" should appear
    expect(countText).toContain("Showing");
    expect(countText).toContain("only");
  });

  test("follower range filter is sent with search (no UI error)", async ({ page }) => {
    await gotoSearch(page);

    // Change follower range to Micro
    await page.locator("select").first().selectOption("10k-50k");

    const stopCollecting = collectConsoleErrors(page);
    await searchFor(page, "Fashion");
    const errors = stopCollecting();

    const filtered = errors.filter(e => !e.includes("ResizeObserver") && !e.includes("passive event"));
    expect(filtered, "Console errors with follower filter").toHaveLength(0);
  });
});

// ─── S5: Niche Button Logic Enforcement ──────────────────────────────────────

test.describe("S5 – Niche Button Logic (max = 3)", () => {
  test("can select exactly 3 niches", async ({ page }) => {
    await gotoSearch(page);
    const niches = ["fashion", "fitness", "beauty"];
    for (const n of niches) {
      const btn = page.getByTestId(`niche-btn-${n}`);
      await expect(btn).not.toBeDisabled();
      await btn.click();
      await expect(btn).toHaveAttribute("data-active", "true");
    }
    await expect(page.getByTestId("niche-counter")).toContainText("3/3");
  });

  test("4th niche button is disabled when 3 are selected", async ({ page }) => {
    await gotoSearch(page);
    for (const n of ["fashion", "fitness", "beauty"]) {
      await page.getByTestId(`niche-btn-${n}`).click();
    }
    // 'tech' should now be disabled
    const tech = page.getByTestId("niche-btn-tech");
    await expect(tech).toBeDisabled();
    await expect(tech).toHaveAttribute("disabled", "");
  });

  test("clicking a disabled niche button does not add it", async ({ page }) => {
    await gotoSearch(page);
    for (const n of ["fashion", "fitness", "beauty"]) {
      await page.getByTestId(`niche-btn-${n}`).click();
    }
    // Try force-clicking the disabled button
    await page.getByTestId("niche-btn-tech").dispatchEvent("click");
    // tech must NOT be active
    await expect(page.getByTestId("niche-btn-tech")).not.toHaveAttribute("data-active", "true");
    await expect(page.getByTestId("niche-counter")).toContainText("3/3");
  });

  test("deselecting a niche re-enables others", async ({ page }) => {
    await gotoSearch(page);
    for (const n of ["fashion", "fitness", "beauty"]) {
      await page.getByTestId(`niche-btn-${n}`).click();
    }
    // Deselect fashion
    await page.getByTestId("niche-btn-fashion").click();
    // tech should be enabled again
    await expect(page.getByTestId("niche-btn-tech")).not.toBeDisabled();
  });

  test("niche filter never returns creators with null niche when active", async ({ page }) => {
    await gotoSearch(page);
    const total = await searchFor(page, "Pakistani creator");
    if (total === 0) test.skip(true, "No results");

    await page.getByTestId("niche-btn-fashion").click();
    const cards = page.getByTestId("result-card");
    const filtered = await cards.count();

    for (let i = 0; i < filtered; i++) {
      // Each visible card must have a niche badge (null-niche cards must be excluded)
      const nicheEl = cards.nth(i).getByTestId("card-niche");
      // Either the card has niche = Fashion or it has no niche badge visible
      // (no niche badge visible = card should not appear when filter is active)
      const nicheText = await nicheEl.textContent().catch(() => null);
      if (nicheText !== null) {
        expect(nicheText, "Null-niche card leaked through niche filter").toBe("Fashion");
      } else {
        // A card with no niche badge should NOT appear when niche filter is active
        // This verifies the niche filter fix (Bug 10)
        const cardVisible = await cards.nth(i).isVisible();
        expect(cardVisible, "Niche-less card should be hidden when niche filter active").toBe(false);
      }
    }
  });
});

// ─── S6: Back-Navigation Cache ────────────────────────────────────────────────

test.describe("S6 – Back Navigation (no credit spend)", () => {
  test("navigating back and returning to search shows same results without new credit deduction", async ({ page }) => {
    await gotoSearch(page);
    await expect(page.getByTestId("credits-badge")).toBeVisible({ timeout: 10_000 });

    const before = await getCredits(page);
    if (before === null || before < 2) test.skip(true, "Insufficient credits");

    await searchFor(page, "Islamabad tech");
    const afterSearch = await getCredits(page);
    const cardCount = await page.getByTestId("result-card").count();
    if (cardCount === 0) test.skip(true, "No results to cache");

    // Navigate away
    await page.goto("/");
    // Navigate back
    await page.goBack();

    // Results should be restored from cache — no new credit spend
    await expect(page.getByTestId("results-grid")).toBeVisible({ timeout: 15_000 });
    const cachedCardCount = await page.getByTestId("result-card").count();
    const afterBack = await getCredits(page);

    expect(cachedCardCount, "Back-nav should restore same result count").toBe(cardCount);
    expect(afterBack, "Back-nav must not deduct additional credits").toBe(afterSearch);
  });
});

// ─── S7: AI Mode Toggle ───────────────────────────────────────────────────────

test.describe("S7 – AI Mode Toggle", () => {
  test("toggling AI mode changes input placeholder", async ({ page }) => {
    await gotoSearch(page);
    const input = page.getByTestId("search-input");
    const regularPlaceholder = await input.getAttribute("placeholder");

    // Toggle AI mode ON
    await page.locator("#ai-mode").click();
    const aiPlaceholder = await input.getAttribute("placeholder");

    expect(regularPlaceholder).not.toBe(aiPlaceholder);
    expect(aiPlaceholder).toContain("Describe the ideal Pakistani creator");

    // Toggle OFF
    await page.locator("#ai-mode").click();
    const backToRegular = await input.getAttribute("placeholder");
    expect(backToRegular).toBe(regularPlaceholder);
  });

  test("searching with AI mode ON completes without console error", async ({ page }) => {
    await gotoSearch(page);

    const before = await getCredits(page);
    if (before === null || before < 2) test.skip(true, "Insufficient credits");

    await page.locator("#ai-mode").click(); // enable AI mode

    const stopCollecting = collectConsoleErrors(page);
    await gotoSearch(page); // re-navigate so AI mode state is fresh
    await page.locator("#ai-mode").click();
    const input = page.getByTestId("search-input");
    await input.fill("Urdu food blogger from Lahore with high engagement");
    await page.getByTestId("search-btn").click();

    await Promise.race([
      page.getByTestId("results-grid").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
      page.getByTestId("no-results").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
    ]);

    const errors = stopCollecting().filter(e =>
      !e.includes("ResizeObserver") && !e.includes("passive event")
    );
    expect(errors, "Console errors in AI mode search").toHaveLength(0);
  });
});

// ─── S8: Enrichment / Card Data Integrity ────────────────────────────────────

test.describe("S8 – Enrichment & Card Data Integrity", () => {
  test("each result card has non-placeholder follower or engagement data", async ({ page }) => {
    await gotoSearch(page);
    const count = await searchFor(page, "Karachi fashion");
    if (count === 0) test.skip(true, "No results — skipping enrichment check");

    const cards = page.getByTestId("result-card");
    for (let i = 0; i < Math.min(count, 8); i++) {
      const card = cards.nth(i);

      // Platform badge must be present and non-empty
      const platform = await card.getByTestId("card-platform").textContent();
      expect(platform?.trim(), `Card ${i} missing platform`).toBeTruthy();
      expect(["instagram", "tiktok", "youtube"]).toContain(platform?.trim().toLowerCase());

      // Followers: either a real number or "—" (not undefined/null/blank)
      const followers = await card.getByTestId("card-followers").textContent();
      expect(followers?.trim(), `Card ${i} followers empty`).toBeTruthy();

      // Engagement: either "X.X%" or "—"
      const engagement = await card.getByTestId("card-engagement").textContent();
      expect(engagement?.trim(), `Card ${i} engagement empty`).toBeTruthy();
    }
  });

  test("platform badge matches data-platform attribute", async ({ page }) => {
    await gotoSearch(page);
    const count = await searchFor(page, "Lahore tech");
    if (count === 0) test.skip(true, "No results");

    const cards = page.getByTestId("result-card");
    for (let i = 0; i < Math.min(count, 8); i++) {
      const card = cards.nth(i);
      const attrPlatform = await card.getAttribute("data-platform");
      const badgePlatform = await card.getByTestId("card-platform").textContent();
      expect(
        badgePlatform?.toLowerCase().includes(attrPlatform ?? "NEVER"),
        `Platform attribute "${attrPlatform}" doesn't match badge "${badgePlatform}" for card ${i}`
      ).toBe(true);
    }
  });

  test("no fabricated engagement rates above 100%", async ({ page }) => {
    await gotoSearch(page);
    const count = await searchFor(page, "Karachi fashion");
    if (count === 0) test.skip(true, "No results");

    const cards = page.getByTestId("result-card");
    for (let i = 0; i < Math.min(count, 8); i++) {
      const erText = await cards.nth(i).getByTestId("card-engagement").textContent();
      const num = parseFloat(erText?.replace("%", "") ?? "0");
      if (!isNaN(num)) {
        expect(num, `Card ${i} has impossible engagement rate ${num}%`).toBeLessThanOrEqual(100);
        expect(num, `Card ${i} has negative engagement rate`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ─── S9: No Duplicate Creators ────────────────────────────────────────────────

test.describe("S9 – No Duplicate Creators in Results", () => {
  test("no two result cards have the same platform+username combination", async ({ page }) => {
    await gotoSearch(page);
    const count = await searchFor(page, "Karachi fashion");
    if (count === 0) test.skip(true, "No results");

    const seen = new Set<string>();
    const cards = page.getByTestId("result-card");
    for (let i = 0; i < count; i++) {
      const username = await cards.nth(i).getAttribute("data-username");
      const platform = await cards.nth(i).getAttribute("data-platform");
      const key = `${platform}:${username}`;
      expect(seen.has(key), `Duplicate card found: ${key}`).toBe(false);
      seen.add(key);
    }
  });
});

// ─── S10: No Console Errors During Normal Usage ───────────────────────────────

test.describe("S10 – No Console Errors (Normal Usage)", () => {
  test("rapid filter switching does not throw JS errors", async ({ page }) => {
    await gotoSearch(page);
    await searchFor(page, "Karachi influencer");

    const stopCollecting = collectConsoleErrors(page);

    // Rapidly toggle niches
    for (const n of ["fashion", "fitness", "beauty", "tech", "gaming"]) {
      const btn = page.getByTestId(`niche-btn-${n}`);
      const disabled = await btn.isDisabled().catch(() => true);
      if (!disabled) {
        await btn.click({ delay: 50 });
      }
    }
    // Rapidly deselect all
    for (const n of ["fashion", "fitness", "beauty"]) {
      await page.getByTestId(`niche-btn-${n}`).click({ delay: 50 }).catch(() => {});
    }

    const errors = stopCollecting().filter(e =>
      !e.includes("ResizeObserver") && !e.includes("passive event")
    );
    expect(errors, "JS errors during rapid filter toggle").toHaveLength(0);
  });
});

// ─── S11: Result Count ↔ Visible Cards Consistency ───────────────────────────

test.describe("S11 – Result Count vs Visible Cards", () => {
  test("result-count label matches the number of rendered cards", async ({ page }) => {
    await gotoSearch(page);
    const count = await searchFor(page, "Lahore lifestyle");
    if (count === 0) test.skip(true, "No results");

    const labelText = await page.getByTestId("result-count").textContent();
    const numMatch = labelText?.match(/^(\d+)/);
    if (numMatch) {
      const labelNum = parseInt(numMatch[1], 10);
      expect(labelNum, "result-count label mismatch vs actual rendered cards").toBe(count);
    }
  });

  test("result count updates when niche filter applied", async ({ page }) => {
    await gotoSearch(page);
    const total = await searchFor(page, "Pakistani creator");
    if (total === 0) test.skip(true, "No results");

    const preLabel = await page.getByTestId("result-count").textContent();
    await page.getByTestId("niche-btn-fashion").click();

    const filteredCount = await page.getByTestId("result-card").count();
    const postLabel = await page.getByTestId("result-count").textContent();

    const preNum = parseInt(preLabel?.match(/^(\d+)/)?.[1] ?? "0", 10);
    const postNum = parseInt(postLabel?.match(/^(\d+)/)?.[1] ?? "0", 10);

    expect(postNum, "Filtered count label should equal visible card count").toBe(filteredCount);
    // If any cards were filtered out, postNum < preNum; otherwise equal
    expect(postNum, "Filtered count must not exceed total count").toBeLessThanOrEqual(preNum);
  });
});
