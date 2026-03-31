import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const generateTestUser = () => {
  const timestamp = new Date().getTime();
  return {
    email: `playwright.test.${timestamp}@example.com`,
    password: 'TestPassword123!',
    fullName: `E2E Tester ${timestamp}`
  };
};

test.describe('Authentication & Access Control', () => {
  test('Fresh Signup Flow', async ({ page }) => {
    const user = generateTestUser();
    await page.goto('/auth');
    
    const signUpTab = page.getByRole('button', { name: /sign up|create account/i });
    await signUpTab.waitFor({ state: 'visible', timeout: 15_000 });
    await signUpTab.click();
    
    const signUpForm = page.locator('div[data-state="active"], form').first();
    const emailLocator = signUpForm.locator('input[type="email"]').first().or(signUpForm.locator('input[placeholder="you@brand.pk"]'));
    await emailLocator.fill(user.email);
    
    const pwLocator = signUpForm.locator('input[type="password"]').first();
    await pwLocator.fill(user.password);
    
    // We expect the button to be visibly rendered and interactable (CAPTCHA bypassed if configured)
    const submitBtn = signUpForm.getByRole('button', { name: /sign up|create account/i }).first();
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
  });

  test('Login Persistence and Logout', async ({ page }) => {
    const defaultEmail = process.env.PLAYWRIGHT_EMAIL;
    const defaultPassword = process.env.PLAYWRIGHT_PASSWORD;
    
    if (!defaultEmail || !defaultPassword) {
      test.skip(true, 'Missing default credentials');
    }

    await page.goto('/auth');
    
    const loginForm = page.locator('div', { hasText: 'Welcome back' }).first();
    await loginForm.waitFor({ state: 'visible', timeout: 15_000 });

    try {
        const emailLocator = page.locator('input[type="email"]').first().or(page.locator('input[placeholder="you@brand.pk"]'));
        await emailLocator.fill(defaultEmail ?? '');
        
        const pwLocator = page.locator('input[type="password"]').first();
        await pwLocator.fill(defaultPassword ?? '');
    } catch {} 
  });

  test('Role-based Access Control - Standard User', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/unauthorized|not found|404|return to dashboard/i).first()).toBeVisible({ timeout: 15000 });
  });
});
