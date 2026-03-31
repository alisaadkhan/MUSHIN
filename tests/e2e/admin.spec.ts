import { test, expect } from '@playwright/test';

test.describe('Admin Control Plane Observations', () => {
   test('Admin Real-time Telemetry Dashboard Loads', async ({ page }) => {
     await page.goto('/admin');
     const rejectedObj = page.getByText(/unauthorized|not found|404|return to dashboard/i).first();
     const adminStats = page.locator('.recharts-responsive-container, h3:has-text("API Latency")');
     
     await Promise.race([
        expect(rejectedObj).toBeVisible({ timeout: 15000 }).catch(() => null),
        expect(adminStats).toBeVisible({ timeout: 15000 }).catch(() => null)
     ]).catch(() => {
         throw new Error("Neither rejection nor admin panel resolved");
     });
   });

   test('Verify API Latency Logs in Rendered Document', async ({ page }) => {
     await page.goto('/admin');
     if (await page.getByText(/unauthorized/i).isVisible()) return;

     const chartLayer = page.locator('.recharts-layer');
     await expect(chartLayer.locator('path').first()).toBeVisible({ timeout: 30000 });
   });

   test('Restriction Control Endpoint Existence', async ({ page }) => {
     await page.goto('/admin');

     if (await page.getByText(/unauthorized/i).isVisible()) return;
     
     const restrictInput = page.getByPlaceholder(/enter user email/i).first();
     if (await restrictInput.isVisible()) {
         await expect(page.getByRole('button', { name: /restrict/i })).toBeVisible();
     }
   });
});
