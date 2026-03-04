import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

/**
 * Playwright configuration for InfluenceIQ Pro E2E tests.
 *
 * Auth strategy:
 *   - `auth.setup.ts` logs in once and saves the browser storage state to
 *     `tests/e2e/.auth/state.json`.  All dependent tests reuse that state, so
 *     authentication only happens once per run.
 *
 * Required env variables:
 *   PLAYWRIGHT_EMAIL    – email address of a test account with ≥ 20 credits
 *   PLAYWRIGHT_PASSWORD – password for that account
 *
 * Optional:
 *   PLAYWRIGHT_BASE_URL – defaults to http://localhost:8080
 */

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: false, // keep sequential so credit counter is predictable
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],
  outputDir: "test-results",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Mimic a mid-range laptop
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    // ── 1. Auth setup (runs first, no storageState dependency) ───────────────
    {
      name: "setup",
      testMatch: "**/auth.setup.ts",
    },

    // ── 2. All search + filter tests (reuse saved auth) ───────────────────────
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/state.json",
      },
      dependencies: ["setup"],
      testIgnore: ["**/auth.setup.ts", "**/stress.spec.ts"],
    },

    // ── 3. Stress tests — separate project to run on-demand ──────────────────
    {
      name: "stress",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/state.json",
      },
      dependencies: ["setup"],
      testMatch: "**/stress.spec.ts",
    },

    // ── 4. Phase 3 Combinatorial Assault — separate project ───────────────────
    {
      name: "phase3",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/state.json",
        // Give each batch test plenty of time (50 searches × ~5s each)
        actionTimeout: 40_000,
      },
      dependencies: ["setup"],
      testMatch: "**/phase3-combinatorial.spec.ts",
      // Phase 3 is sequential — parallel would corrupt the credit counter
      fullyParallel: false,
    },
  ],
});
