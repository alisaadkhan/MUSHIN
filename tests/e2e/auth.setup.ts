/**
 * auth.setup.ts
 *
 * Logs in once with PLAYWRIGHT_EMAIL / PLAYWRIGHT_PASSWORD and saves the
 * resulting browser storage state to tests/e2e/.auth/state.json.
 * All other test projects depend on this project and reuse the saved state,
 * keeping the test suite fast and credential-safe.
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";

// Use process.cwd() (workspace root) to avoid __dirname ESM issues
const STATE_PATH = path.join(process.cwd(), "tests/e2e/.auth/state.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.PLAYWRIGHT_EMAIL;
  const password = process.env.PLAYWRIGHT_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD must be set in your environment. " +
      "Create a test account in Supabase with ≥20 search credits."
    );
  }

  await page.goto("/auth");
  await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15_000 });

  await page.fill("input[type='email']", email);
  await page.fill("input[type='password']", password);
  await page.click("button[type='submit']");

  // Wait until we land on a dashboard page (not /auth)
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 20_000 });

  await page.context().storageState({ path: STATE_PATH });
  console.log(`✅ Auth state saved to ${STATE_PATH}`);
});
