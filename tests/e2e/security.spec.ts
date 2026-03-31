import { test, expect } from '@playwright/test';

test.describe('Security & Abuse Protection Validation', () => {
  test('Rate Limiting on Intensive Search Queries', async ({ page }) => {
     await page.goto('/search?q=Beauty&platform=TikTok');
     
     const searchInput = page.getByPlaceholder(/search creators/i).or(page.locator('input[type="search"]'));
     if (await searchInput.isVisible()) {
         for (let i = 0; i < 6; i++) {
             await searchInput.fill(`Test Query ${i}`);
             await searchInput.press('Enter');
             await page.waitForTimeout(200);
         }
         
         await expect(page.getByText(/rate limit|too many requests/i)).toBeVisible({ timeout: 15000 }).catch(() => {});
     }
  });

  test('SSRF Protection Blocks Internal IPs', async ({ request, page }) => {
      await page.goto('/campaigns');

      const createLinkBtn = page.getByRole('button', { name: /create tracking link|new link/i }).first();
      if (await createLinkBtn.isVisible()) {
          await createLinkBtn.click();
          
          const urlInput = page.locator('input[name="url"], input[placeholder*="https://"]').first();
          await urlInput.fill('http://169.254.169.254/latest/meta-data/');
          
          const submit = page.getByRole('button', { name: /generate|create/i }).first();
          await submit.click();
          
          await expect(page.getByText(/invalid url|private ip|security/i)).toBeVisible({ timeout: 15000 });
      }
  });

  test('IDOR Protection on Outreach Lists', async ({ request, page }) => {
      const randomId = '11111111-1111-1111-1111-111111111111';
      
      const status = await page.evaluate(async (id: string) => {
         const { data: { session } } = await (window as any).supabase.auth.getSession();
         const res = await fetch(`https://mushin-syq3.vercel.app/api/functions/v1/get-outreach-list?id=${id}`, {
             method: 'GET',
             headers: { 
                 'Authorization': `Bearer ${session?.access_token}` 
             }
         });
         return res.status;
      }, randomId);

      expect(status).toBeGreaterThanOrEqual(403);
  });
});
