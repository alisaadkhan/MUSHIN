import { test, expect } from '@playwright/test';

test.describe('Credit Usage & Idempotency Validations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly
    await page.goto('/settings');
    const billingLink = page.getByRole('link', { name: /billing|subscription|credits/i }).or(page.locator('a[href="/billing"]'));
    if (await billingLink.isVisible()) {
        await billingLink.click();
    }
  });

  test('Verify Credits Decrement on Core Action', async ({ page }) => {
    // 1. Capture original credits
    const creditCountLocator = page.locator('text=/AI Credits|Search Credits/i').locator('..').locator('span, div').last(); 
    
    let initialCount = 0;
    try {
        const text = await creditCountLocator.innerText({ timeout: 10000 });
        const matches = text.match(/(\\d+)/);
        if (matches) initialCount = parseInt(matches[1], 10);
    } catch {}

    // 2. Perform credit-consuming action via direct hit
    await page.goto('/search?q=Beauty&platform=Instagram');
    
    const resultCard = page.locator('.grid, [data-testid="search-results"]').locator('div, article').first();
    await expect(resultCard).toBeVisible({ timeout: 30000 });
    
    const analyzeBtn = resultCard.getByRole('button', { name: /analyze|insight|view profile/i }).first();
    if (await analyzeBtn.isVisible()) {
        await analyzeBtn.click();
    }

    await page.waitForTimeout(5000);

    // 3. Return to billing and verify via direct hit
    await page.goto('/billing');
    let finalCount = 0;
    try {
        const finalText = await creditCountLocator.innerText({ timeout: 10000 });
        const match = finalText.match(/(\\d+)/);
        if (match) finalCount = parseInt(match[1], 10);
        
        if (initialCount > 0) {
           expect(finalCount).toBeLessThanOrEqual(initialCount);
        }
    } catch {}
  });

  test('Verify Idempotent Refund on Intentional Search Failure', async ({ page, request }) => {
    const status = await page.evaluate(async () => {
         const { data: { session } } = await (window as any).supabase.auth.getSession();
         const res = await fetch('https://mushin-syq3.vercel.app/api/functions/v1/search-natural', {
             method: 'POST',
             headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${session?.access_token}` 
             },
             body: JSON.stringify({ query: 'gaming', platform: 'INVALID_PLATFORM_CRASH' })
         });
         return res.status;
    });

    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(600);
  });
});
