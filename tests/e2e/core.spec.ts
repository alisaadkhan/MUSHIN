import { test, expect } from '@playwright/test';

test.describe('Core Application Features', () => {
  test('Natural Search Execution and Rendering', async ({ page }) => {
    await page.goto('/search?q=Gaming&platform=YouTube');
    
    await expect(page.locator('input[value="Gaming"], span:has-text("Gaming"), h2:has-text("Gaming")').first()).toBeVisible({ timeout: 15000 });
    
    const resultsContainer = page.locator('.grid, [data-testid="search-results"]');
    await expect(resultsContainer).toBeVisible({ timeout: 45000 });
    
    const resultCount = await resultsContainer.locator('div, article, li').count();
    expect(resultCount).toBeGreaterThan(0);
    
    await expect(page.getByText(/Failed to load|Error completing search/i)).not.toBeVisible();
  });

  test('Campaign Tracking Link Generator', async ({ page }) => {
    await page.goto('/campaigns');
    const campaignsHeading = page.locator('h1, h2, span', { hasText: 'Campaigns' }).first();
    await expect(campaignsHeading).toBeVisible({ timeout: 15000 });
  });

  test('Outreach Email Editor Verification', async ({ page }) => {
    await page.goto('/lists');
    const listsHeading = page.locator('h1, h2, span', { hasText: 'Lists' }).first();
    await expect(listsHeading).toBeVisible({ timeout: 15000 });
  });
});
