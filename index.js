import puppeteer from "puppeteer";
import fs from "fs";
import dotenv from "dotenv";
import path from "path"; // Re-introducing path for better debug logging

dotenv.config();

// Load posts (assuming this file exists at ./config/posts_full_year.json)
const posts = JSON.parse(fs.readFileSync("./config/posts_full_year.json", "utf8"));
const USER = process.env.LINKEDIN_USER;
const PASS = process.env.LINKEDIN_PASS;

// Use 'new' headless mode if HEADLESS is not explicitly 'false'
const HEADLESS_MODE = process.env.HEADLESS === "false" ? false : 'new';
const MIN_DELAY = parseInt(process.env.MIN_DELAY_SEC) || 30;
const MAX_DELAY = parseInt(process.env.MAX_DELAY_SEC) || 120;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  const ms = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY) * 1000;
  return delay(ms);
}

const today = new Date().toISOString().split("T")[0];
const post = posts.find((p) => p.date === today);

if (!post) {
  console.log(`No post scheduled for ${today}.`);
  process.exit(0);
}

console.log(`Posting for ${today}: ${post.content}`);

(async () => {
  let browser;
  try {
    // --- CRITICAL PATH RESOLUTION FOR RENDER ---
    // This logic checks if the provided ENV variable is a known bad generic path 
    // and overrides it with Puppeteer's calculated path if so.
    
    let executablePathToUse = process.env.PUPPETEER_EXECUTABLE_PATH;
    const knownBadPaths = ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];

    if (!executablePathToUse || knownBadPaths.includes(executablePathToUse)) {
        // Case 1: ENV variable is missing OR it is set to a known bad generic path.
        // We override the path with Puppeteer's own calculated, version-specific path.
        executablePathToUse = puppeteer.executablePath();
        
        if (knownBadPaths.includes(process.env.PUPPETEER_EXECUTABLE_PATH)) {
            console.warn(`⚠️ Overriding invalid executablePath (${process.env.PUPPETEER_EXECUTABLE_PATH}) with Puppeteer's calculated path.`);
        } else {
            console.warn("⚠️ PUPPETEER_EXECUTABLE_PATH is missing. Relying on Puppeteer's default detection.");
        }
        console.log(`🚀 Final executablePath chosen: ${executablePathToUse}`);

    } else {
        // Case 2: User has manually set the ENV variable and it's not a known bad generic path.
        console.log(`✅ Using user-configured PUPPETEER_EXECUTABLE_PATH: ${executablePathToUse}`);
    }
    
    const launchOptions = {
      headless: HEADLESS_MODE,
      executablePath: executablePathToUse,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] 
    };
    
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    // LinkedIn login
    await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2" });
    await page.type("#username", USER, { delay: 50 });
    await page.type("#password", PASS, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    // Go to homepage and open post box
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "networkidle2" });
    await randomDelay();

    // Check if the share box trigger is visible before clicking
    await page.waitForSelector(".share-box-feed-entry__trigger", { visible: true });
    await page.click(".share-box-feed-entry__trigger");
    
    // Wait for the rich text editor to appear
    await page.waitForSelector(".ql-editor", { visible: true });
    await page.type(".ql-editor", post.content, { delay: 30 });

    await randomDelay();
    
    // Wait for the post button and click it
    await page.waitForSelector('button[data-control-name="share.post"]', { visible: true });
    await page.click('button[data-control-name="share.post"]');

    console.log("✅ Posted successfully to LinkedIn");
    await delay(5000);
    
  } catch (err) {
    console.error("❌ Error during LinkedIn posting:", err);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
