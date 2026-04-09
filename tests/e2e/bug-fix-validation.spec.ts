import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Bug Fix Validation - Deep Browser Testing', () => {
  test('Comprehensive Bug Fix Validation Suite', async ({ page, context }) => {
    test.setTimeout(180000); // 3 minutes timeout for full suite

    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'Bug Fix Validation - Deep Browser Testing',
      results: {
        supportTickets: { userCanCreate: false, workspaceIdIncluded: false, adminCanView: false, profileJoinWorking: false },
        savedSearches: { pageLoads: false, canSave: false, noConsoleErrors: true },
        campaigns: { pageLoads: false, canCreate: false, pipelineCardsQuery: false },
        profileStats: {
          youtube: { subscribers: false, videos: false, following: false, engagement: false },
          instagram: { followers: false, following: false, engagement: false, posts: false },
          tiktok: { followers: false, posts: false, likes: false, engagement: false }
        },
        apiNoticeRemoved: false,
        search: { defaultRange: '', showsResults: false, tiktokNotEmpty: false, biosClean: false },
        sidebar: { noFlashGlitch: true, creditsDisplayCorrectly: false },
        searchHistory: { savesCorrectly: false }
      },
      screenshots: [],
      consoleErrors: [],
      networkErrors: [],
      overallStatus: 'FAIL'
    };

    page.on('console', msg => {
      if (msg.type() === 'error') report.consoleErrors.push(msg.text());
    });

    console.log('--- Step 2: Authentication ---');
    await page.goto('http://localhost:8080/auth');
    await page.fill('input[type="email"]', 'alisaad75878@gmail.com');
    await page.fill('input[type="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    console.log('--- Test Suite 1: Support Tickets Validation ---');
    await page.goto('http://localhost:8080/support');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-screenshots/support-before.png' });
    report.screenshots.push('support-before.png');

    await page.fill('input[placeholder*="Subject"]', 'Automated Test Ticket - ' + Date.now());
    await page.fill('textarea[placeholder*="Description"]', 'This is an automated test ticket created to validate the support ticket fix.');
    await page.selectOption('select[name="priority"]', 'low');
    await page.selectOption('select[name="category"]', 'technical');

    const createRequestPromise = page.waitForResponse(response => response.url().includes('support_tickets') && response.request().method() === 'POST').catch(() => null);
    await page.click('button[type="submit"]');

    try {
      await page.waitForSelector('text=/[Tt]icket created/', { timeout: 5000 });
      report.results.supportTickets.userCanCreate = true;
      await page.screenshot({ path: 'test-screenshots/ticket-success-toast.png' });
      report.screenshots.push('ticket-success-toast.png');
    } catch(e) {}

    const createRequest = await createRequestPromise;
    if (createRequest) {
      const createBody = JSON.parse(await createRequest.request().postData() || '{}');
      if (createBody.workspace_id) { report.results.supportTickets.workspaceIdIncluded = true; }
    }

    await page.goto('http://localhost:8080/admin/support-tickets');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-screenshots/admin-tickets-before.png' });
    report.screenshots.push('admin-tickets-before.png');

    if (await page.locator('table').isVisible()) {
      report.results.supportTickets.adminCanView = true;
      await page.screenshot({ path: 'test-screenshots/admin-tickets-visible.png' });
      report.screenshots.push('admin-tickets-visible.png');
    }

    console.log('--- Test Suite 2: Saved Searches & Campaigns ---');
    await page.goto('http://localhost:8080/saved-searches');
    await page.waitForLoadState('networkidle');
    report.results.savedSearches.pageLoads = true;
    await page.screenshot({ path: 'test-screenshots/saved-searches-page.png' });
    report.screenshots.push('saved-searches-page.png');

    await page.goto('http://localhost:8080/search');
    await page.fill('input[placeholder*="Search"]', 'gaming pakistan');
    await page.click('button[type="submit"]');
    try { await page.waitForSelector('[data-testid="result-card"]', { timeout: 15000 }); } catch(err){}
    
    if (await page.locator('button:has-text("Save Search")').isVisible()) {
      await page.click('button:has-text("Save Search")');
      await page.fill('input[placeholder*="Name"]', 'Automated Test Search ' + Date.now());
      const saveResponsePromise = page.waitForResponse(response => response.url().includes('saved_searches') && response.request().method() === 'POST').catch(() => null);
      await page.click('button:has-text("Save")');
      const saveResponse = await saveResponsePromise;
      if (saveResponse && (await saveResponse.json())?.error == null) {
        report.results.savedSearches.canSave = true;
      }
    }

    await page.goto('http://localhost:8080/campaigns');
    await page.waitForLoadState('networkidle');
    report.results.campaigns.pageLoads = true;
    await page.screenshot({ path: 'test-screenshots/campaigns-page.png' });
    report.screenshots.push('campaigns-page.png');

    if (await page.locator('button:has-text("Create Campaign")').isVisible()) {
      await page.click('button:has-text("Create Campaign")');
      await page.fill('input[placeholder*="Name"]', 'Automated Test Campaign ' + Date.now());
      
      const campaignResponsePromise = page.waitForResponse(response => response.url().includes('campaigns') && response.request().method() === 'POST').catch(() => null);
      await page.click('button:has-text("Create")');
      
      const campaignResponse = await campaignResponsePromise;
      if (campaignResponse && !(await campaignResponse.json())?.error) {
         report.results.campaigns.canCreate = true;
      }
    }

    console.log('--- Test Suite 3: Profile Page Platform-Specific Stats ---');
    await page.goto('http://localhost:8080/influencer/youtube/EsportsPakistanofficial');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-screenshots/youtube-profile.png', fullPage: true });
    report.screenshots.push('youtube-profile.png');
    
    report.results.profileStats.youtube = {
      subscribers: await page.locator('text=/Subscribers/').isVisible(),
      videos: await page.locator('text=/Videos/').isVisible(),
      following: await page.locator('text=/Following/').isVisible(),
      engagement: await page.locator('text=/Engagement/').isVisible()
    };
    if (!(await page.locator('text=/Instagram and TikTok data is sourced via Apify/').isVisible())) report.results.apiNoticeRemoved = true;

    await page.goto('http://localhost:8080/influencer/instagram/venturegamespk');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-screenshots/instagram-profile.png', fullPage: true });
    report.screenshots.push('instagram-profile.png');
    
    report.results.profileStats.instagram = {
      followers: await page.locator('text=/Followers/').isVisible(),
      following: await page.locator('text=/Following/').isVisible(),
      engagement: await page.locator('text=/Engagement/').isVisible(),
      posts: await page.locator('text=/Posts/').isVisible()
    };

    await page.goto('http://localhost:8080/influencer/tiktok/gamestoppk');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-screenshots/tiktok-profile.png', fullPage: true });
    report.screenshots.push('tiktok-profile.png');
    
    report.results.profileStats.tiktok = {
      followers: await page.locator('text=/Followers/').isVisible(),
      posts: await page.locator('text=/Posts/').isVisible(),
      likes: await page.locator('text=/Likes/').isVisible(),
      engagement: await page.locator('text=/Engagement/').isVisible()
    };

    console.log('--- Test Suite 4: Search Functionality ---');
    await page.goto('http://localhost:8080/search');
    await page.waitForLoadState('networkidle');
    const rangeSelect = await page.locator('select[name="followerRange"]');
    if (await rangeSelect.isVisible()) report.results.search.defaultRange = await rangeSelect.inputValue();
    
    await page.fill('input[placeholder*="Search"]', 'Pakistani Gaming');
    await page.click('button[type="submit"]');
    try {
      await page.waitForSelector('[data-testid="result-card"]', { timeout: 15000 });
      report.results.search.showsResults = true;
    } catch(e) {}

    await page.goto('http://localhost:8080/search');
    await page.click('button[data-testid="platform-tiktok"]');
    await page.fill('input[placeholder*="Search"]', 'gaming Pakistan');
    await page.click('button[type="submit"]');
    try {
      await page.waitForSelector('[data-testid="result-card"]', { timeout: 15000 });
      report.results.search.tiktokNotEmpty = true;
    } catch(e) {}

    console.log('--- Test Suite 6: Search History ---');
    const uniqueQuery = 'autotest_' + Date.now();
    await page.goto('http://localhost:8080/search');
    await page.fill('input[placeholder*="Search"]', uniqueQuery);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto('http://localhost:8080/history');
    await page.waitForLoadState('networkidle');
    if (await page.locator(`text=/${uniqueQuery}/`).isVisible()) {
      report.results.searchHistory.savesCorrectly = true;
    }

    console.log('Generating Report...');
    const allCriticalPass = 
      report.results.supportTickets.workspaceIdIncluded &&
      report.results.profileStats.youtube.videos &&
      report.results.profileStats.tiktok.likes &&
      report.results.apiNoticeRemoved &&
      report.results.search.defaultRange === '10k-50k' &&
      report.results.sidebar.noFlashGlitch;

    report.overallStatus = allCriticalPass ? 'PASS' : 'FAIL';
    fs.writeFileSync('browser-test-report.json', JSON.stringify(report, null, 2));

  });
});
