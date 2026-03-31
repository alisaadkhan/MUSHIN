import { chromium } from "playwright";

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    console.log("Navigating to /auth");
    await page.goto("https://mushin-syq3.vercel.app/auth");
    
    await page.waitForTimeout(5000);
    console.log("Current URL:", page.url());
    
    const bodyArgs = await page.locator("body").innerHTML();
    console.log(`Body HTML length: ${bodyArgs.length}`);
    
    await browser.close();
})();
