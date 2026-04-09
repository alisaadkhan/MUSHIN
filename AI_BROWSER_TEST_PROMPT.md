# AI Browser Testing Agent - Comprehensive Bug Fix Validation

## Mission

You are an automated browser testing agent. Your task is to perform **deep, comprehensive validation** of all bug fixes in the MUSHIN SaaS platform by interacting with the application in a real browser environment. You must test each fix thoroughly, capture evidence (screenshots, console logs, network requests), and generate a detailed validation report.

---

## Environment Setup

```bash
# Prerequisites
- Node.js 18+ installed
- Playwright browsers installed: `npx playwright install`
- Dev server running on http://localhost:8080
- Test credentials available (email/password or Google OAuth)
```

---

## Test Execution Instructions

### Step 1: Initialize Testing Session

1. Start a fresh browser session (incognito/private mode)
2. Clear all cookies and localStorage before each test suite
3. Enable console log capture
4. Enable network request monitoring
5. Set viewport to 1920x1080 (desktop) and 375x667 (mobile) for responsive testing

### Step 2: Authentication

```javascript
// Navigate to auth page
await page.goto('http://localhost:8080/auth');

// If using test credentials:
await page.fill('input[type="email"]', 'test@mushin.app');
await page.fill('input[type="password"]', 'TestPassword123!');
await page.click('button[type="submit"]');

// Wait for auth to complete
await page.waitForURL('**/dashboard');
await page.waitForLoadState('networkidle');

// Capture auth state
const authState = await page.evaluate(() => ({
  user: localStorage.getItem('auth_user'),
  token: localStorage.getItem('auth_token'),
  workspace: localStorage.getItem('auth_workspace')
}));
console.log('Auth State:', authState);
```

### Step 3: Execute Test Suites

---

## Test Suite 1: Support Tickets Validation

### Test 1.1: User Creates Support Ticket

```javascript
// Navigate to support page
await page.goto('http://localhost:8080/support');
await page.waitForLoadState('networkidle');

// Capture initial state
const beforeScreenshot = await page.screenshot({ path: 'support-before.png' });

// Fill ticket form
await page.fill('input[placeholder*="Subject"]', 'Automated Test Ticket - ' + Date.now());
await page.fill('textarea[placeholder*="Description"]', 'This is an automated test ticket created to validate the support ticket fix. Timestamp: ' + new Date().toISOString());
await page.selectOption('select[name="priority"]', 'low');
await page.selectOption('select[name="category"]', 'technical');

// Submit form
await page.click('button[type="submit"]');

// Wait for success toast
await page.waitForSelector('text=/[Tt]icket created/', { timeout: 5000 });
const successToast = await page.screenshot({ path: 'ticket-success-toast.png' });

// Capture network request
const createRequest = await page.waitForResponse(
  response => response.url().includes('support_tickets') && response.request().method() === 'POST'
);
const createBody = JSON.parse(await createRequest.postData());
console.log('Ticket Create Request:', createBody);

// Validate workspace_id was included
if (createBody.workspace_id) {
  console.log('✅ workspace_id included in ticket creation');
} else {
  console.error('❌ workspace_id MISSING from ticket creation');
}

// Capture ticket list
await page.waitForTimeout(2000);
const ticketList = await page.screenshot({ path: 'user-ticket-list.png' });
```

### Test 1.2: Admin Views All Tickets

```javascript
// Navigate to admin panel
await page.goto('http://localhost:8080/admin/support-tickets');
await page.waitForLoadState('networkidle');

// Capture admin tickets page
const adminTicketsBefore = await page.screenshot({ path: 'admin-tickets-before.png' });

// Check for tickets table
const ticketsTable = await page.locator('table').isVisible();
const emptyState = await page.locator('text=/[Nn]o tickets/').isVisible();

if (ticketsTable) {
  console.log('✅ Admin tickets table visible');
  
  // Count tickets
  const ticketCount = await page.locator('tbody tr').count();
  console.log(`📊 Found ${ticketCount} tickets in admin panel`);
  
  // Capture first few tickets
  const ticketsVisible = await page.screenshot({ path: 'admin-tickets-visible.png' });
  
  // Check if our test ticket appears
  const testTicketVisible = await page.locator(`text=/Automated Test Ticket/`).isVisible();
  if (testTicketVisible) {
    console.log('✅ Test ticket visible in admin panel');
  } else {
    console.warn('⚠️ Test ticket not immediately visible (may need refresh)');
  }
} else if (emptyState) {
  console.log('ℹ️ No tickets found (empty state)');
} else {
  console.error('❌ Admin tickets not loading properly');
  const errorScreenshot = await page.screenshot({ path: 'admin-tickets-error.png' });
}

// Capture network request for admin tickets fetch
const adminRequest = await page.waitForResponse(
  response => response.url().includes('support_tickets') && response.request().method() === 'GET'
);
const adminData = await adminRequest.json();
console.log('Admin Tickets Response:', adminData);

// Check for profiles join
if (adminData.data && adminData.data[0]) {
  const hasProfile = 'profiles' in adminData.data[0] || 'user_id' in adminData.data[0];
  console.log(hasProfile ? '✅ Profile join working' : '⚠️ Profile join may have issues');
}
```

---

## Test Suite 2: Saved Searches & Campaigns

### Test 2.1: Saved Searches Functionality

```javascript
// Navigate to saved searches
await page.goto('http://localhost:8080/saved-searches');
await page.waitForLoadState('networkidle');

const savedSearchesScreenshot = await page.screenshot({ path: 'saved-searches-page.png' });

// Check for errors in console
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

if (consoleErrors.length > 0) {
  console.error('❌ Console errors on saved searches page:', consoleErrors);
} else {
  console.log('✅ No console errors on saved searches page');
}

// Try to create a saved search
await page.goto('http://localhost:8080/search');
await page.fill('input[placeholder*="Search"]', 'gaming pakistan');
await page.click('button[type="submit"]');
await page.waitForSelector('[data-testid="result-card"]', { timeout: 15000 });

// Click save search
const saveButton = await page.locator('button:has-text("Save Search")');
if (await saveButton.isVisible()) {
  await saveButton.click();
  await page.fill('input[placeholder*="Name"]', 'Automated Test Search ' + Date.now());
  await page.click('button:has-text("Save")');
  
  const saveResponse = await page.waitForResponse(
    response => response.url().includes('saved_searches') && response.request().method() === 'POST'
  );
  const saveData = await saveResponse.json();
  
  if (saveData.error) {
    console.error('❌ Save search failed:', saveData.error);
  } else {
    console.log('✅ Search saved successfully');
  }
}
```

### Test 2.2: Campaigns Functionality

```javascript
// Navigate to campaigns
await page.goto('http://localhost:8080/campaigns');
await page.waitForLoadState('networkidle');

const campaignsScreenshot = await page.screenshot({ path: 'campaigns-page.png' });

// Check for campaign list or empty state
const campaignList = await page.locator('[data-testid="campaign-list"]').isVisible();
const emptyCampaigns = await page.locator('text=/[Nn]o campaigns/').isVisible();

console.log(campaignList ? '✅ Campaign list visible' : emptyCampaigns ? 'ℹ️ No campaigns (empty state)' : '⚠️ Campaign page state unclear');

// Try to create campaign
const createCampaignBtn = await page.locator('button:has-text("Create Campaign")');
if (await createCampaignBtn.isVisible()) {
  await createCampaignBtn.click();
  
  // Fill campaign form
  await page.fill('input[placeholder*="Name"]', 'Automated Test Campaign ' + Date.now());
  await page.click('button:has-text("Create")');
  
  const campaignResponse = await page.waitForResponse(
    response => response.url().includes('campaigns') && response.request().method() === 'POST'
  );
  const campaignData = await campaignResponse.json();
  
  if (campaignData.error) {
    console.error('❌ Campaign creation failed:', campaignData.error);
    const errorScreenshot = await page.screenshot({ path: 'campaign-create-error.png' });
  } else {
    console.log('✅ Campaign created successfully');
    const successScreenshot = await page.screenshot({ path: 'campaign-create-success.png' });
  }
}

// Check for pipeline_cards query
const campaignFetch = await page.waitForResponse(
  response => response.url().includes('campaigns') && response.url().includes('pipeline_cards')
).catch(() => null);

if (campaignFetch) {
  const campaignData = await campaignFetch.json();
  if (campaignData.error) {
    console.error('❌ Campaigns with pipeline_cards query failed:', campaignData.error);
  } else {
    console.log('✅ Campaigns with pipeline_cards query successful');
  }
}
```

---

## Test Suite 3: Profile Page Platform-Specific Stats

### Test 3.1: YouTube Profile

```javascript
await page.goto('http://localhost:8080/influencer/youtube/EsportsPakistanofficial');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000); // Wait for data to load

const youtubeProfile = await page.screenshot({ path: 'youtube-profile.png', fullPage: true });

// Check for YouTube-specific stats
const stats = {
  subscribers: await page.locator('text=/Subscribers/').isVisible(),
  videos: await page.locator('text=/Videos/').isVisible(),
  following: await page.locator('text=/Following/').isVisible(),
  engagement: await page.locator('text=/Engagement/').isVisible()
};

console.log('YouTube Profile Stats Labels:', stats);

// Validate all 4 labels present
const allPresent = Object.values(stats).every(v => v === true);
console.log(allPresent ? '✅ All YouTube stats visible' : '❌ Missing YouTube stats');

// Check API notice is REMOVED
const apiNotice = await page.locator('text=/Instagram and TikTok data is sourced via Apify/').isVisible();
console.log(apiNotice ? '❌ API notice STILL PRESENT (should be removed)' : '✅ API notice removed');

// Extract actual values
const statsValues = await page.evaluate(() => {
  const statCards = document.querySelectorAll('.grid-cols-2 > div, .grid-cols-4 > div');
  const values = [];
  statCards.forEach(card => {
    const label = card.querySelector('p:last-child')?.textContent?.trim();
    const value = card.querySelector('p:first-child')?.textContent?.trim();
    if (label && value) values.push({ label, value });
  });
  return values;
});

console.log('YouTube Stats Values:', statsValues);
```

### Test 3.2: Instagram Profile

```javascript
await page.goto('http://localhost:8080/influencer/instagram/venturegamespk');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);

const instagramProfile = await page.screenshot({ path: 'instagram-profile.png', fullPage: true });

// Check for Instagram-specific stats
const igStats = {
  followers: await page.locator('text=/Followers/').isVisible(),
  following: await page.locator('text=/Following/').isVisible(),
  engagement: await page.locator('text=/Engagement/').isVisible(),
  posts: await page.locator('text=/Posts/').isVisible()
};

console.log('Instagram Profile Stats Labels:', igStats);

// API notice should be removed
const igApiNotice = await page.locator('text=/Instagram and TikTok data is sourced via Apify/').isVisible();
console.log(igApiNotice ? '❌ API notice STILL PRESENT' : '✅ API notice removed');

// Extract stats values
const igStatsValues = await page.evaluate(() => {
  const statCards = document.querySelectorAll('.grid-cols-2 > div, .grid-cols-4 > div');
  const values = [];
  statCards.forEach(card => {
    const label = card.querySelector('p:last-child')?.textContent?.trim();
    const value = card.querySelector('p:first-child')?.textContent?.trim();
    if (label && value) values.push({ label, value });
  });
  return values;
});

console.log('Instagram Stats Values:', igStatsValues);
```

### Test 3.3: TikTok Profile

```javascript
await page.goto('http://localhost:8080/influencer/tiktok/gamestoppk');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);

const tiktokProfile = await page.screenshot({ path: 'tiktok-profile.png', fullPage: true });

// Check for TikTok-specific stats
const ttStats = {
  followers: await page.locator('text=/Followers/').isVisible(),
  posts: await page.locator('text=/Posts/').isVisible(),
  likes: await page.locator('text=/Likes/').isVisible(),  // TikTok should show Likes, not Following
  engagement: await page.locator('text=/Engagement/').isVisible()
};

console.log('TikTok Profile Stats Labels:', ttStats);

// Validate Likes is present (not Following)
console.log(ttStats.likes ? '✅ TikTok shows Likes (correct)' : '❌ TikTok missing Likes stat');

// API notice should be removed
const ttApiNotice = await page.locator('text=/Instagram and TikTok data is sourced via Apify/').isVisible();
console.log(ttApiNotice ? '❌ API notice STILL PRESENT' : '✅ API notice removed');
```

---

## Test Suite 4: Search Functionality

### Test 4.1: Default Follower Range

```javascript
await page.goto('http://localhost:8080/search');
await page.waitForLoadState('networkidle');

// Check default follower range
const rangeSelect = await page.locator('select[name="followerRange"]');
const defaultValue = await rangeSelect.inputValue();

console.log(`Default follower range: ${defaultValue}`);
console.log(defaultValue === '10k-50k' ? '✅ Default is 10k-50k (correct)' : `❌ Default is ${defaultValue} (should be 10k-50k)`);

// Take screenshot of filter panel
const filterPanel = await page.locator('.bg-card.border-border').screenshot({ path: 'search-filters.png' });
```

### Test 4.2: Search Shows Results with Default Filter

```javascript
// Perform search with default filters
await page.fill('input[placeholder*="Search"]', 'Pakistani Gaming');
await page.click('button[type="submit"]');

// Wait for results
try {
  await page.waitForSelector('[data-testid="result-card"]', { timeout: 20000 });
  console.log('✅ Search results loaded');
} catch (e) {
  console.error('❌ No search results found');
  const noResults = await page.screenshot({ path: 'search-no-results.png' });
}

// Count results
const resultCount = await page.locator('[data-testid="result-card"]').count();
console.log(`📊 Found ${resultCount} search results`);

// Check follower counts on cards
const cards = await page.locator('[data-testid="result-card"]');
const cardCount = await cards.count();

let cardsWithFollowers = 0;
let cardsWithEmptyFollowers = 0;

for (let i = 0; i < Math.min(cardCount, 10); i++) {
  const followerText = await cards.nth(i).locator('[data-testid="card-followers"]').textContent();
  if (followerText && followerText !== '—' && /[\d.]+[KMBkmb]/.test(followerText)) {
    cardsWithFollowers++;
  } else {
    cardsWithEmptyFollowers++;
  }
}

console.log(`📊 Cards with follower counts: ${cardsWithFollowers}/${Math.min(cardCount, 10)}`);
console.log(`📊 Cards without follower counts: ${cardsWithEmptyFollowers}/${Math.min(cardCount, 10)}`);

// Capture search results
const searchResults = await page.screenshot({ path: 'search-results.png', fullPage: true });

// Capture network request to search-influencers
const searchRequest = await page.waitForResponse(
  response => response.url().includes('search-influencers') && response.request().method() === 'POST'
);
const searchBody = JSON.parse(await searchRequest.postData());
const searchResponse = await searchRequest.json();

console.log('Search Request Body:', searchBody);
console.log('Search Response Count:', searchResponse.results?.length || 0);
console.log('Search Follower Range:', searchBody.followerRange);
```

### Test 4.3: TikTok Search (Previously Empty)

```javascript
await page.goto('http://localhost:8080/search');
await page.click('button[data-testid="platform-tiktok"]');
await page.fill('input[placeholder*="Search"]', 'gaming Pakistan');
await page.click('button[type="submit"]');

try {
  await page.waitForSelector('[data-testid="result-card"]', { timeout: 20000 });
  const ttResultCount = await page.locator('[data-testid="result-card"]').count();
  console.log(`✅ TikTok search returned ${ttResultCount} results (previously was empty)`);
  
  const ttResults = await page.screenshot({ path: 'tiktok-search-results.png', fullPage: true });
} catch (e) {
  console.error('❌ TikTok search still returning no results');
  const ttEmpty = await page.screenshot({ path: 'tiktok-search-empty.png' });
}
```

### Test 4.4: Bio Display Cleaning

```javascript
// Navigate to search with results that have bios
await page.goto('http://localhost:8080/search?q=gaming&platform=instagram');
await page.waitForSelector('[data-testid="result-card"]', { timeout: 15000 });

const cards = await page.locator('[data-testid="result-card"]');
const cardCount = await cards.count();

let cleanBios = 0;
let dirtyBios = 0;

for (let i = 0; i < Math.min(cardCount, 5); i++) {
  const bioElement = cards.nth(i).locator('.line-clamp-2');
  const bioText = await bioElement.textContent();
  
  if (bioText) {
    // Check for dirty patterns
    const hasFollowerPrefix = /^\d+[kKmMbB]?\s*followers/i.test(bioText.trim());
    const hasPostPrefix = /^\d+[kKmMbB]?\s*posts/i.test(bioText.trim());
    const hasLeadingSeparator = /^[·|]/.test(bioText.trim());
    
    if (hasFollowerPrefix || hasPostPrefix || hasLeadingSeparator) {
      dirtyBios++;
      console.log(`❌ Dirty bio found: "${bioText.substring(0, 80)}..."`);
    } else {
      cleanBios++;
    }
  }
}

console.log(`📊 Clean bios: ${cleanBios}/${Math.min(cardCount, 5)}`);
console.log(`📊 Dirty bios: ${dirtyBios}/${Math.min(cardCount, 5)}`);

// Capture bio examples
const bioScreenshot = await page.screenshot({ path: 'search-bios.png' });
```

---

## Test Suite 5: Sidebar Plan Display (No Flash Glitch)

### Test 5.1: Fresh Load Plan Display

```javascript
// Clear all storage to simulate fresh load
await page.context().clearCookies();
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// Navigate to dashboard
const navigationStart = Date.now();
await page.goto('http://localhost:8080/dashboard');

// Capture frame-by-frame during loading
const loadingStates = [];
let frameCount = 0;

const captureInterval = setInterval(async () => {
  const planElement = await page.locator('text=/Plan|Free|Pro|Business|Loading/').first();
  if (await planElement.isVisible()) {
    const text = await planElement.textContent();
    loadingStates.push({ time: Date.now() - navigationStart, text });
    frameCount++;
  }
}, 100);

// Wait for plan to stabilize
await page.waitForFunction(() => {
  const planEl = document.querySelector('[class*="Plan"]');
  return planEl && planEl.textContent && !planEl.textContent.includes('Loading');
}, { timeout: 10000 });

clearInterval(captureInterval);

console.log('Loading state transitions:', loadingStates);

// Check if "Free" appeared before actual plan loaded
const freeFlash = loadingStates.some(state => state.text?.includes('Free') && state.time < 1000);
console.log(freeFlash ? '❌ Plan flash glitch detected (showed Free before loading)' : '✅ No plan flash glitch');

// Capture final state
const creditsWidget = await page.screenshot({ path: 'sidebar-credits.png' });

// Extract final credits display
const creditsText = await page.locator('text=/\\d+ \\/ \\d+/').first().textContent();
console.log('Final credits display:', creditsText);
```

---

## Test Suite 6: Search History

### Test 6.1: Search Saved to History

```javascript
// Perform a unique search
const uniqueQuery = 'autotest_' + Date.now();
await page.goto('http://localhost:8080/search');
await page.fill('input[placeholder*="Search"]', uniqueQuery);
await page.click('button[type="submit"]');
await page.waitForSelector('[data-testid="result-card"]', { timeout: 15000 });

// Wait for history to be saved
await page.waitForTimeout(3000);

// Navigate to history
await page.goto('http://localhost:8080/history');
await page.waitForLoadState('networkidle');

// Check if search appears in history
const historyEntry = await page.locator(`text=/${uniqueQuery}/`).isVisible();
console.log(historyEntry ? '✅ Search saved to history' : '❌ Search not in history');

// Capture history page
const historyPage = await page.screenshot({ path: 'search-history.png', fullPage: true });

// Check network request for history fetch
const historyRequest = await page.waitForResponse(
  response => response.url().includes('search_history') && response.request().method() === 'GET'
);
const historyData = await historyRequest.json();
console.log('History entries:', historyData.data?.length || 0);
```

---

## Step 4: Generate Comprehensive Report

```javascript
const report = {
  timestamp: new Date().toISOString(),
  testSuite: 'Bug Fix Validation - Deep Browser Testing',
  results: {
    supportTickets: {
      userCanCreate: true/false,
      workspaceIdIncluded: true/false,
      adminCanView: true/false,
      profileJoinWorking: true/false
    },
    savedSearches: {
      pageLoads: true/false,
      canSave: true/false,
      noConsoleErrors: true/false
    },
    campaigns: {
      pageLoads: true/false,
      canCreate: true/false,
      pipelineCardsQuery: true/false
    },
    profileStats: {
      youtube: { subscribers: bool, videos: bool, following: bool, engagement: bool },
      instagram: { followers: bool, following: bool, engagement: bool, posts: bool },
      tiktok: { followers: bool, posts: bool, likes: bool, engagement: bool }
    },
    apiNoticeRemoved: true/false,
    search: {
      defaultRange: '10k-50k' or 'other',
      showsResults: true/false,
      tiktokNotEmtpy: true/false,
      biosClean: true/false
    },
    sidebar: {
      noFlashGlitch: true/false,
      creditsDisplayCorrectly: true/false
    },
    searchHistory: {
      savesCorrectly: true/false
    }
  },
  screenshots: [
    'support-before.png',
    'ticket-success-toast.png',
    'admin-tickets-visible.png',
    'saved-searches-page.png',
    'campaigns-page.png',
    'youtube-profile.png',
    'instagram-profile.png',
    'tiktok-profile.png',
    'search-filters.png',
    'search-results.png',
    'tiktok-search-results.png',
    'search-bios.png',
    'sidebar-credits.png',
    'search-history.png'
  ],
  consoleErrors: [],
  networkErrors: [],
  overallStatus: 'PASS' or 'FAIL'
};

// Calculate overall status
const allCriticalPass = 
  report.results.supportTickets.workspaceIdIncluded &&
  report.results.profileStats.youtube.videos &&
  report.results.profileStats.tiktok.likes &&
  report.results.apiNoticeRemoved &&
  report.results.search.defaultRange === '10k-50k' &&
  report.results.sidebar.noFlashGlitch;

report.overallStatus = allCriticalPass ? 'PASS' : 'FAIL';

// Save report
const fs = require('fs');
fs.writeFileSync('browser-test-report.json', JSON.stringify(report, null, 2));
console.log('Test report saved to browser-test-report.json');
```

---

## Output Requirements

1. **JSON Report**: `browser-test-report.json` with all test results
2. **Screenshots**: All captured images in `test-screenshots/` directory
3. **Console Logs**: Full console output saved to `test-console.log`
4. **Network Logs**: All API requests/responses saved to `test-network.json`
5. **Video Recording**: Full test session recorded (if supported)

---

## Success Criteria

| Test | Pass Condition |
|------|----------------|
| Support Tickets | workspace_id included in create request, admin can view tickets |
| Saved Searches | Page loads, can save searches, no console errors |
| Campaigns | Page loads, can create campaigns, pipeline_cards query works |
| YouTube Profile | Shows Subscribers, Videos, Following, Engagement |
| Instagram Profile | Shows Followers, Following, Engagement, Posts |
| TikTok Profile | Shows Followers, Posts, Likes, Engagement |
| API Notice | Not visible on any profile page |
| Search Default | Follower range defaults to 10k-50k |
| Search Results | Shows results (not empty), TikTok works |
| Bio Cleaning | No follower count prefixes in bios |
| Sidebar | No plan flash glitch, credits display correctly |
| Search History | Searches are saved to history |

**OVERALL PASS**: All critical tests pass (Support Tickets, Profile Stats, API Notice, Search Default, Sidebar)

---

## Execution Command

```bash
npx playwright test tests/e2e/bug-fix-validation.spec.ts --project=chromium --headed --video=on --screenshot=on
```

---

## Notes for AI Agent

- Be thorough: Test edge cases, not just happy paths
- Capture evidence: Every test failure must have a screenshot
- Log everything: Console errors, network failures, timeouts
- Be patient: Wait for networkidle and appropriate timeouts
- Clean state: Clear cookies/storage between test suites
- Report honestly: Mark tests as FAIL if they don't meet criteria
- Retry flaky tests: Up to 2 retries for network-related failures
- Mobile testing: Run critical tests on mobile viewport too

---

**Good luck! Your thorough testing ensures production quality.** 🚀
