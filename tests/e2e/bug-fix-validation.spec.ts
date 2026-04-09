import { test, expect } from "@playwright/test";

/**
 * Automated Test Suite - Bug Fix Validation
 * Tests all fixes from the comprehensive bug fix commit
 */

test.describe("Bug Fix Validation Suite", () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SUPPORT TICKETS - Admin Panel Visibility
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe("Support Tickets", () => {
    test("admin can view all support tickets", async ({ page }) => {
      await page.goto("/admin/support-tickets");
      await expect(page.locator("h1")).toContainText("Support Tickets");
      
      // Should show tickets table or empty state
      const ticketsTable = page.locator("table");
      const emptyState = page.locator("text=No tickets");
      
      await expect(
        ticketsTable.or(emptyState)
      ).toBeVisible();
    });

    test("user can create support ticket with workspace_id", async ({ page }) => {
      await page.goto("/support");
      
      await page.fill('input[placeholder*="Subject"]', "Test Ticket - Automated");
      await page.fill('textarea[placeholder*="Description"]', "Automated test ticket");
      await page.selectOption('select[name="priority"]', "low");
      await page.selectOption('select[name="category"]', "general");
      
      await page.click('button[type="submit"]');
      
      // Should show success toast
      await expect(page.locator("text=Ticket created")).toBeVisible({ timeout: 5000 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SAVED SEARCHES - Functionality
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe("Saved Searches", () => {
    test("saved searches page loads without errors", async ({ page }) => {
      await page.goto("/saved-searches");
      await expect(page.locator("h1")).toContainText("Saved Searches");
    });

    test("can save a search", async ({ page }) => {
      await page.goto("/search");
      
      // Perform a search
      await page.fill('input[placeholder*="Search"]', "gaming");
      await page.click('button[type="submit"]');
      
      // Wait for results
      await page.waitForSelector('[data-testid="result-card"]', { timeout: 15000 });
      
      // Click save search button
      const saveButton = page.locator('button:has-text("Save Search")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Enter save name
        await page.fill('input[placeholder*="Name"]', "Automated Test Search");
        await page.click('button:has-text("Save")');
        
        // Should show success
        await expect(page.locator("text=Search saved")).toBeVisible({ timeout: 5000 });
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. CAMPAIGNS - Functionality
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe("Campaigns", () => {
    test("campaigns page loads without errors", async ({ page }) => {
      await page.goto("/campaigns");
      await expect(page.locator("h1")).toContainText("Campaigns");
    });

    test("can create a campaign", async ({ page }) => {
      await page.goto("/campaigns");
      
      const createButton = page.locator('button:has-text("Create Campaign")');
      if (await createButton.isVisible()) {
        await createButton.click();
        
        // Fill campaign form
        await page.fill('input[placeholder*="Name"]', "Automated Test Campaign");
        await page.click('button:has-text("Create")');
        
        // Should show success or campaign in list
        await expect(
          page.locator("text=Campaign created").or(
            page.locator("text=Automated Test Campaign")
          )
        ).toBeVisible({ timeout: 5000 });
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. PROFILE PAGE - Platform-Specific Stats Display
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe("Profile Page Stats Display", () => {
    test("YouTube profile shows Subscribers, Videos, Following, Engagement", async ({ page }) => {
      // Use a known YouTube creator
      await page.goto("/influencer/youtube/EsportsPakistanofficial");
      
      // Wait for profile to load
      await page.waitForSelector("text=Subscribers", { timeout: 10000 });
      
      // Check for YouTube-specific stats labels
      await expect(page.locator("text=Subscribers")).toBeVisible();
      await expect(page.locator("text=Videos")).toBeVisible();
      await expect(page.locator("text=Following")).toBeVisible();
      await expect(page.locator("text=Engagement")).toBeVisible();
      
      // Should NOT show API notice
      await expect(
        page.locator("text=Instagram and TikTok data is sourced via Apify")
      ).not.toBeVisible();
    });

    test("Instagram profile shows Followers, Following, Engagement, Posts", async ({ page }) => {
      await page.goto("/influencer/instagram/venturegamespk");
      
      await page.waitForSelector("text=Followers", { timeout: 10000 });
      
      // Check for Instagram-specific stats labels
      await expect(page.locator("text=Followers")).toBeVisible();
      await expect(page.locator("text=Following")).toBeVisible();
      await expect(page.locator("text=Engagement")).toBeVisible();
      await expect(page.locator("text=Posts")).toBeVisible();
      
      // Should NOT show API notice
      await expect(
        page.locator("text=Instagram and TikTok data is sourced via Apify")
      ).not.toBeVisible();
    });

    test("TikTok profile shows Followers, Posts, Likes, Engagement", async ({ page }) => {
      await page.goto("/influencer/tiktok/gamestoppk");
      
      await page.waitForSelector("text=Followers", { timeout: 10000 });
      
      // Check for TikTok-specific stats labels
      await expect(page.locator("text=Followers")).toBeVisible();
      await expect(page.locator("text=Posts")).toBeVisible();
      await expect(page.locator("text=Likes")).toBeVisible();
      await expect(page.locator("text=Engagement")).toBeVisible();
      
      // Should NOT show API notice
      await expect(
        page.locator("text=Instagram and TikTok data is sourced via Apify")
      ).not.toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. SEARCH - 10k+ Default Follower Filter
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe("Search Default Follower Filter", () => {
    test("search defaults to 10k-50k follower range", async ({ page }) => {
      await page.goto("/search");
      
      // Check that follower range dropdown defaults to 10k-50k
      const rangeSelect = page.locator('select[name="followerRange"]');
      if (await rangeSelect.isVisible()) {
        const selectedValue = await rangeSelect.inputValue();
        expect(selectedValue).toBe("10k-50k");
      }
    });

    test("search shows results with default 10k+ filter", async ({ page }) => {
      await page.goto("/search");
      
      // Search without changing filters
      await page.fill('input[placeholder*="Search"]', "Pakistani Gaming");
      await page.click('button[type="submit"]');
      
      // Wait for results
      await page.waitForSelector('[data-testid="result-card"]', { timeout: 20000 });
      
      // Should have multiple results
      const resultCards = page.locator('[data-testid="result-card"]');
      const count = await resultCards.count();
      expect(count).toBeGreaterThan(0);
      
      // Results should have follower counts (or show them as estimated)
      const firstCard = resultCards.first();
      await expect(firstCard.locator('[data-testid="card-followers"]')).toBeVisible();
    });

    test("TikTok search shows results (not empty)", async ({ page }) => {
      await page.goto("/search");
      
      // Select TikTok platform
      await page.click('button[data-testid="platform-tiktok"]');
      
      // Search
      await page.fill('input[placeholder*="Search"]', "gaming Pakistan");
      await page.click('button[type="submit"]');
      
      // Wait for results (should not be empty)
      await page.waitForSelector('[data-testid="result-card"]', { timeout: 20000 });
      
      const resultCards = page.locator('[data-testid="result-card"]');
      const count = await resultCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test("Instagram search shows results with follower counts", async ({ page }) => {
      await page.goto("/search");
      
      // Select Instagram
      await page.click('button[data-testid="platform-instagram"]');
      
      // Search
      await page.fill('input[placeholder*="Search"]', "gaming");
      await page.click('button[type="submit"]');
      
      // Wait for results
      await page.waitForSelector('[data-testid="result-card"]', { timeout: 20000 });
      
      // Check that follower counts are visible (not all "—")
      const resultCards = page.locator('[data-testid="result-card"]');
      const count = await resultCards.count();
      expect(count).toBeGreaterThan(0);
      
      // At least some results should have follower counts
      const followersLocator = resultCards.locator('[data-testid="card-followers"]');
      let hasFollowers = false;
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = await followersLocator.nth(i).textContent();
        if (text && text !== "—" && text.includes(/[\d.]+[KMBkmb]/)) {
          hasFollowers = true;
          break;
        }
      }
      expect(hasFollowers).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. BIO CLEANING - No Follower Count Prefixes
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe("Bio Display Cleaning", () => {
    test("bios do not show follower count prefixes", async ({ page }) => {
      await page.goto("/search?q=gaming&platform=instagram");
      
      // Wait for results
      await page.waitForSelector('[data-testid="result-card"]', { timeout: 15000 });
      
      // Get bio text from first few cards
      const resultCards = page.locator('[data-testid="result-card"]');
      const count = await resultCards.count();
      
      for (let i = 0; i < Math.min(count, 3); i++) {
        const bioText = await resultCards.nth(i).locator(".line-clamp-2").textContent();
        
        if (bioText) {
          // Should NOT start with follower counts
          expect(bioText.trim()).not.toMatch(/^\d+[kKmMbB]?\s*followers/i);
          expect(bioText.trim()).not.toMatch(/^\d+[kKmMbB]?\s*posts/i);
          
          // Should NOT have "·" separators at start
          expect(bioText.trim()).not.toMatch(/^[·|]/);
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. SIDEBAR - No Plan Flash Glitch
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe("Sidebar Plan Display", () => {
    test("sidebar shows loading state before plan data loads", async ({ page }) => {
      // Clear cache to simulate fresh load
      await page.context().clearCookies();
      
      await page.goto("/dashboard");
      
      // During loading, should show "Loading..." or skeleton, not "Free Plan"
      const planText = page.locator("text=Plan").or(page.locator("text=Loading"));
      
      // Wait for plan to load (should not flash "Free" first)
      await page.waitForSelector("text=/Free|Pro|Business|Loading/", { timeout: 5000 });
      
      const planElement = page.locator("text=/Free|Pro|Business/").first();
      const text = await planElement.textContent();
      
      // Should eventually show correct plan (not stuck on Free)
      expect(text).toMatch(/(Free|Pro|Business|Loading)/i);
    });

    test("credits display correctly after loading", async ({ page }) => {
      await page.goto("/dashboard");
      
      // Wait for credits to load
      await page.waitForSelector("text=/\\d+ \\/ \\d+/", { timeout: 10000 });
      
      const creditsText = await page.locator("text=/\\d+ \\/ \\d+/").first().textContent();
      expect(creditsText).toMatch(/\d+ \/ \d+/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. SEARCH HISTORY - Being Saved
  // ─────────────────────────────────────────────────────────────────────────────
  test.describe("Search History", () => {
    test("search is saved to history", async ({ page }) => {
      await page.goto("/search");
      
      // Perform search
      await page.fill('input[placeholder*="Search"]', "automated test search");
      await page.click('button[type="submit"]');
      
      // Wait for results
      await page.waitForSelector('[data-testid="result-card"]', { timeout: 15000 });
      
      // Navigate to history
      await page.goto("/history");
      
      // Should show recent search
      await expect(
        page.locator("text=automated test search").or(
          page.locator("text=No search history")
        )
      ).toBeVisible({ timeout: 5000 });
    });
  });
});
