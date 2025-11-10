import puppeteer from "puppeteer";
import fs from "fs";
import dotenv from "dotenv";
// import path from "path"; // No longer needed

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
    // The code logic below is correct. The error in the last run was that 
    // the user had set PUPPETEER_EXECUTABLE_PATH to an incorrect value 
    // (/usr/bin/chromium) in the Render dashboard.
    
    const launchOptions = {
      headless: HEADLESS_MODE,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] // Common args for container stability
    };
    
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        // Case 1: User has manually set the ENV variable.
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
        console.log(`✅ Using configured PUPPETEER_EXECUTABLE_PATH: ${launchOptions.executablePath}`);
    } else {
        // Case 2: ENV variable is not set. RELY ON PUPPETEER'S DEFAULT DETECTION.
        // This is the most reliable method for Render if a manual ENV is not required.
        console.warn("⚠️ PUPPETEER_EXECUTABLE_PATH is missing. Relying on default detection.");
        console.warn("   If this run fails, you MUST manually set PUPPETEER_EXECUTABLE_PATH in Render's dashboard.");
        console.warn("   Try setting it to the path from the BUILD LOG: /opt/render/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome");
    }
    
    // NOTE: If PUPPETEER_EXECUTABLE_PATH is cleared in the dashboard, the executablePath property
    // will be omitted, allowing Puppeteer's internal resolver (puppeteer.launch()) 
    // to search for the installed browser, which is what we need.
    
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
