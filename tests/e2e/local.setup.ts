import { test as setup } from '@playwright/test';

setup('authenticate locally', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'alisaad75878@gmail.com');
  await page.fill('input[type="password"]', 'Test123!');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard');
  
  // Wait for session to be fully established in localStorage
  await page.waitForLoadState('networkidle');
  
  await page.context().storageState({ path: 'tests/e2e/.auth/local_state.json' });
});
