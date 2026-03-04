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
      testIgnore: [
        "**/auth.setup.ts",
        "**/stress.spec.ts",
        "**/phase3-combinatorial.spec.ts",
        "**/regression-9a9d783.spec.ts",
      ],
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

    // ── 4. Phase 3 — Combinatorial Assault (run on-demand) ───────────────────
    //    npx playwright test --project=phase3
    //    Set COMBO_LIMIT=1000 for full run, COMBO_LIMIT=120 (default) for dev
    {
      name: "phase3",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/state.json",
      },
      dependencies: ["setup"],
      testMatch: "**/phase3-combinatorial.spec.ts",
    },

    // ── 5. Regression Certification — post-patch validation ──────────────────
    //    npx playwright test --project=regression
    //    Set RG_COMBO_LIMIT=800 for the full 800-combination assault
    //    Default RG_COMBO_LIMIT=50 for dev mode
    {
      name: "regression",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/state.json",
      },
      dependencies: ["setup"],
      testMatch: "**/regression-9a9d783.spec.ts",
    },
  ],
});
