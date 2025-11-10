import puppeteer from "puppeteer";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const posts = JSON.parse(fs.readFileSync("./config/posts_full_year.json", "utf8"));
const USER = process.env.LINKEDIN_USER;
const PASS = process.env.LINKEDIN_PASS;
const HEADLESS = process.env.HEADLESS === "true";
const MIN_DELAY = parseInt(process.env.MIN_DELAY_SEC) || 30;
const MAX_DELAY = parseInt(process.env.MAX_DELAY_SEC) || 120;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay() { return delay((Math.random() * (MAX_DELAY - MIN_DELAY) + MIN_DELAY) * 1000); }

const today = new Date().toISOString().split("T")[0];
const post = posts.find(p => p.date === today);
if (!post) {
  console.log(`No post scheduled for ${today}.`);
  process.exit(0);
}

console.log(`Posting for ${today}: ${post.content}`);

(async () => {
  try {
    const browser = await puppeteer.launch({
      headless: HEADLESS,
      executablePath:
        "/opt/render/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto("https://www.linkedin.com/login", { waitUntil: "networkidle2" });
    await page.type("#username", USER, { delay: 50 });
    await page.type("#password", PASS, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "networkidle2" });
    await randomDelay();

    await page.click(".share-box-feed-entry__trigger");
    await page.waitForSelector(".ql-editor", { visible: true });
    await page.type(".ql-editor", post.content, { delay: 30 });
    await randomDelay();
    await page.click('button[data-control-name="share.post"]');

    console.log("✅ Posted successfully to LinkedIn");
    await delay(5000);
    await browser.close();
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
