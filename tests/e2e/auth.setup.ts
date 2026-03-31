import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.resolve(".auth/state.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.PLAYWRIGHT_EMAIL;
  const password = process.env.PLAYWRIGHT_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing PLAYWRIGHT_EMAIL or PLAYWRIGHT_PASSWORD environment variables. " +
        "Run tests with `PLAYWRIGHT_EMAIL=xxx PLAYWRIGHT_PASSWORD=xxx npx playwright test`"
    );
  }

  await page.goto("/auth");
  
  // Directly interact with the primary authentication form elements
  const emailLocator = page.locator("input[type='email']", { hasText: "" }).first().or(page.locator('input[placeholder="you@brand.pk"]'));
  await expect(emailLocator).toBeVisible({ timeout: 15_000 });
  await emailLocator.fill(email);
  
  const pwLocator = page.locator('input[type="password"]').first();
  await pwLocator.fill(password);

  const submitButton = page.getByRole("button", { name: /sign in/i }).first();
  
  // Wait for submission to become fully active natively (assuming Turnstile is correctly disabled via VITE_DISABLE_CAPTCHA)
  await expect(submitButton).toBeEnabled({ timeout: 15_000 });
  await submitButton.click();

  // Validate we reach the dashboard successfully
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page.locator('h1, h2, span', { hasText: /Dashboard|Overview/i }).first()).toBeVisible({ timeout: 15_000 });

  await page.context().storageState({ path: authFile });
});
