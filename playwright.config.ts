import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

/**
 * Playwright configuration for Mushin E2E tests.
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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://mushin-syq3.vercel.app",
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

    // ── 2. Comprehensive Automations ───────────────────────
    {
      name: "e2e-chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/state.json",
      },
      dependencies: ["setup"],
      testMatch: ["**/auth.spec.ts", "**/core.spec.ts", "**/credits.spec.ts", "**/security.spec.ts", "**/admin.spec.ts"]
    },
    {
      name: "e2e-firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "tests/e2e/.auth/state.json",
      },
      dependencies: ["setup"],
      testMatch: ["**/auth.spec.ts", "**/core.spec.ts", "**/credits.spec.ts", "**/security.spec.ts", "**/admin.spec.ts"]
    },
    {
      name: "e2e-webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: "tests/e2e/.auth/state.json",
      },
      dependencies: ["setup"],
      testMatch: ["**/auth.spec.ts", "**/core.spec.ts", "**/credits.spec.ts", "**/security.spec.ts", "**/admin.spec.ts"]
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

    // ── 6. Live Quality Audit — headed Chrome, real API, no mocking ──────────
    //    npx playwright test --project=audit
    //    AUDIT_LIMIT=30 (default dev) / 300 (full)
    //    AUDIT_MIN_CREDITS=5 — stops if workspace credits fall below this
    {
      name: "audit",
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        storageState: "tests/e2e/.auth/state.json",
        video: "on",
        screenshot: "on",
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ["setup"],
      testMatch: "**/live-quality-audit.spec.ts",
      timeout: 120_000,
    },

    // ── 7. Keyword Quality Audit — 50 keywords × 6 variations = 300 searches ──
    //    npx playwright test --project=keyword-audit
    //    KW_LIMIT=50 (all keywords), VAR_LIMIT=6 (all variations)
    //    KW_MIN_CREDITS=5 — stops if workspace credits fall below this
    {
      name: "keyword-audit",
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        storageState: "tests/e2e/.auth/state.json",
        video: "retain-on-failure",
        screenshot: "on",
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ["setup"],
      testMatch: "**/keyword-quality-audit.spec.ts",
      timeout: 120_000,
    },

    // ── 8. Deep Capture — full field extraction per card + profile visit ────
    //    npx playwright test --project=deep-capture
    //    COMBO_LIMIT=60 PROFILE_DEPTH=3 (defaults)
    {
      name: "deep-capture",
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        storageState: "tests/e2e/.auth/state.json",
        video: "retain-on-failure",
        screenshot: "on",
        viewport: { width: 1440, height: 900 },
      },
      // dependencies: ["setup"],  // skipped — reuse existing state.json
      testMatch: "**/deep-capture.spec.ts",
      timeout: 180_000,
    },
  ],
});
