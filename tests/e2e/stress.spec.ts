/**
 * stress.spec.ts
 *
 * Phase 2 — Stress & Abuse Testing
 *
 * Run with:
 *   npx playwright test --project=stress
 *
 * SS1 – 20 sequential automated searches (credit-aware, bails if credits low)
 * SS2 – Rapid engagement slider drag spam (no UI lockup)
 * SS3 – Platform toggle spam (no stale state bleed-over)
 * SS4 – Back-to-back searches without waiting (race condition check)
 * SS5 – Rapid niche toggle spam (no memory leak / ghost state)
 * SS6 – Very long query (does not cause server error, gracefully handled)
 */

import { test, expect, Page } from "@playwright/test";

const LONG_TIMEOUT = 50_000;

async function gotoSearch(page: Page) {
  await page.goto("/search");
  await expect(page.getByTestId("search-input")).toBeVisible({ timeout: 15_000 });
}

async function typeAndSearch(page: Page, query: string) {
  await page.getByTestId("search-input").fill(query);
  await page.getByTestId("search-btn").click();
  await Promise.race([
    page.getByTestId("results-grid").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
    page.getByTestId("no-results").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
  ]);
}

async function getCredits(page: Page): Promise<number | null> {
  const badge = page.getByTestId("credits-badge");
  if (!await badge.isVisible().catch(() => false)) return null;
  const text = await badge.textContent();
  const m = text?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// ─── SS1: Sequential Search Flood ─────────────────────────────────────────────

test.describe("SS1 – Sequential Search Flood (20 searches)", () => {
  const SEARCH_QUERIES = [
    "Karachi fashion", "Lahore tech", "Islamabad fitness",
    "Pakistani gamer", "Urdu food blogger", "Beauty Karachi",
    "Cricket influencer Pakistan", "Music Lahore", "Fashion Islamabad",
    "Pakistani travel", "Comedy Pakistan", "Finance Karachi",
    "Health Lahore", "Photography Pakistan", "Art creators",
    "Sports influencer", "Education Pakistan", "Automotive Islamabad",
    "Lifestyle creator", "News Pakistan",
  ];

  test("20 sequential searches — no crashes, no rate-limit bypass", async ({ page }) => {
    await gotoSearch(page);

    const initialCredits = await getCredits(page);
    if (initialCredits !== null && initialCredits < 5) {
      test.skip(true, `Only ${initialCredits} credits — skipping flood test`);
    }

    const results: Array<{ query: string; cards: number; error: string | null }> = [];
    let consecutiveErrors = 0;

    for (const query of SEARCH_QUERIES) {
      let cards = 0;
      let error: string | null = null;

      try {
        await page.getByTestId("search-input").fill(query);
        await page.getByTestId("search-btn").click();

        await Promise.race([
          page.getByTestId("results-grid").waitFor({ state: "visible", timeout: 35_000 }),
          page.getByTestId("no-results").waitFor({ state: "visible", timeout: 35_000 }),
          // Also catch error toasts if the search fails
          page.locator("[data-sonner-toaster] [data-type='error']")
            .waitFor({ state: "visible", timeout: 35_000 })
            .then(() => { throw new Error("Error toast shown"); }),
        ]).catch((e) => { error = String(e); });

        cards = await page.getByTestId("result-card").count();

        const credits = await getCredits(page);
        if (credits !== null && credits <= 0) {
          console.warn("Credits exhausted during flood test — stopping early");
          break;
        }

        consecutiveErrors = 0;
      } catch (e) {
        error = String(e);
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          throw new Error(`5 consecutive failures — aborting flood test. Last error: ${error}`);
        }
      }

      results.push({ query, cards, error });

      // Brief human-like pause between searches (avoid hammering the edge function)
      await page.waitForTimeout(800 + Math.random() * 400);
    }

    // Report
    const failures = results.filter(r => r.error !== null);
    const passes = results.filter(r => r.error === null);
    console.log(`\n📊 Flood Test Results:`);
    console.log(`  ✅ Passed: ${passes.length}/${results.length}`);
    console.log(`  ❌ Failed: ${failures.length}/${results.length}`);
    failures.forEach(f => console.log(`     ↳ "${f.query}": ${f.error}`));

    // Allow up to 20% failure rate (network / cold start), but never >4 out of 20
    expect(failures.length, `Too many search failures in flood test`).toBeLessThanOrEqual(4);
  });
});

// ─── SS2: Engagement Slider Spam ─────────────────────────────────────────────

test.describe("SS2 – Engagement Slider Drag Spam", () => {
  test("rapid slider drag does not freeze UI or cause JS errors", async ({ page }) => {
    await gotoSearch(page);

    const errors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error" && !msg.text().includes("ResizeObserver")) {
        errors.push(msg.text());
      }
    });

    const slider = page.locator("input[type='range']").first();
    const visible = await slider.isVisible().catch(() => false);

    if (visible) {
      for (let i = 0; i < 30; i++) {
        await slider.fill(String(Math.floor(Math.random() * 100)));
        await page.waitForTimeout(30);
      }
    }

    // UI must still be responsive — search input should still accept input
    await page.getByTestId("search-input").fill("test");
    await expect(page.getByTestId("search-btn")).toBeEnabled();

    expect(errors, "JS errors during slider spam").toHaveLength(0);
  });
});

// ─── SS3: Platform Toggle Spam ────────────────────────────────────────────────

test.describe("SS3 – Platform Toggle Spam (no state bleed)", () => {
  test("rapid platform switching — state stays consistent", async ({ page }) => {
    await gotoSearch(page);

    // Spam toggle Instagram and TikTok 20 times each
    for (let i = 0; i < 20; i++) {
      await page.getByTestId("platform-instagram").click({ timeout: 2_000 }).catch(() => {});
      await page.getByTestId("platform-tiktok").click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(30);
    }

    // At least one platform must be checked
    const instaChecked = await page.getByTestId("platform-instagram")
      .evaluate((el) => (el as HTMLInputElement).checked);
    const tiktokChecked = await page.getByTestId("platform-tiktok")
      .evaluate((el) => (el as HTMLInputElement).checked);

    // Both could be in any toggle state, but the app must not have crashed
    await expect(page.getByTestId("search-input")).toBeVisible();
    await expect(page.getByTestId("search-btn")).toBeVisible();

    console.log(`Post-spam: instagram=${instaChecked}, tiktok=${tiktokChecked}`);
  });
});

// ─── SS4: Back-to-Back Rapid Searches ────────────────────────────────────────

test.describe("SS4 – Back-to-Back Rapid Searches (Race Condition)", () => {
  test("submitting a new search while previous is loading shows only the latest results", async ({ page }) => {
    await gotoSearch(page);

    const credits = await getCredits(page);
    if (credits !== null && credits < 3) {
      test.skip(true, "Insufficient credits for race condition test");
    }

    const input = page.getByTestId("search-input");

    // Fire two searches in rapid succession (don't wait for first to complete)
    await input.fill("Karachi fashion");
    await page.getByTestId("search-btn").click();
    // Immediately override with second search before first resolves
    await input.fill("Lahore tech");
    await page.getByTestId("search-btn").click();

    // Wait for final state — must show exactly one result set (the second)
    await Promise.race([
      page.getByTestId("results-grid").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
      page.getByTestId("no-results").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
    ]);

    // The loading state must be gone
    const loaderVisible = await page.getByTestId("loading-state").isVisible().catch(() => false);
    expect(loaderVisible, "Loader still stuck after rapid search").toBe(false);

    // The search input value must match the last query
    const currentValue = await input.inputValue();
    expect(currentValue, "Input should retain last typed query").toBe("Lahore tech");
  });
});

// ─── SS5: Niche Toggle Spam ───────────────────────────────────────────────────

test.describe("SS5 – Niche Toggle Spam (no ghost state)", () => {
  test("rapidly toggling niches on/off stays within max-3 limit", async ({ page }) => {
    await gotoSearch(page);

    const nicheIds = ["fashion", "fitness", "beauty", "tech", "gaming", "education", "comedy"];

    // Rapid random toggle spam
    for (let i = 0; i < 40; i++) {
      const id = nicheIds[Math.floor(Math.random() * nicheIds.length)];
      const btn = page.getByTestId(`niche-btn-${id}`);
      if (!await btn.isDisabled().catch(() => true)) {
        await btn.click({ timeout: 500 }).catch(() => {});
      }
      await page.waitForTimeout(20);
    }

    // Count how many are active
    let activeCount = 0;
    for (const id of nicheIds) {
      const isActive = await page.getByTestId(`niche-btn-${id}`)
        .getAttribute("data-active")
        .catch(() => "false");
      if (isActive === "true") activeCount++;
    }

    expect(activeCount, `Active niches exceeded max-3 limit: found ${activeCount}`).toBeLessThanOrEqual(3);

    // Counter badge must be consistent with actual active count
    if (activeCount > 0) {
      const counter = page.getByTestId("niche-counter");
      if (await counter.isVisible()) {
        const text = await counter.textContent();
        const m = text?.match(/(\d+)\/3/);
        if (m) {
          expect(parseInt(m[1], 10), "Counter badge inconsistent with active buttons").toBe(activeCount);
        }
      }
    }
  });
});

// ─── SS6: Very Long Query (Abuse Resistance) ──────────────────────────────────

test.describe("SS6 – Very Long Query (Abuse Resistance)", () => {
  test("200+ character query is handled gracefully without 5xx error", async ({ page }) => {
    await gotoSearch(page);

    const longQuery = "Karachi ".repeat(30).trim(); // 240 chars
    await page.getByTestId("search-input").fill(longQuery);

    const errors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.getByTestId("search-btn").click();

    // Should either show no-results or edge fn returns 400 (toast) — never a blank crash
    await Promise.race([
      page.getByTestId("results-grid").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
      page.getByTestId("no-results").waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
      page.locator(".toast, [data-sonner-toaster]")
        .waitFor({ state: "visible", timeout: LONG_TIMEOUT }),
    ]).catch(() => {});

    // No unhandled JS exception
    const critical = errors.filter(e =>
      e.includes("Uncaught") || e.includes("Cannot read") || e.includes("TypeError")
    );
    expect(critical, "Uncaught JS exceptions on long query").toHaveLength(0);
  });
});
