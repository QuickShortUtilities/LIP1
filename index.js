import fs from "fs";
import dotenv from "dotenv";
import puppeteer from "puppeteer";

dotenv.config();

const posts = JSON.parse(fs.readFileSync("./config/posts_full_year.json", "utf8"));
const today = new Date().toISOString().split("T")[0];
const post = posts.find(p => p.date === today);

if (!post) {
  console.log("No post found for today:", today);
  process.exit(0);
}

(async () => {
  console.log(`Posting for ${today}:`, post.content);

  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === "true" ? true : false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  await page.goto("https://www.linkedin.com/login");
  await page.type("#username", process.env.LINKEDIN_USER, { delay: 100 });
  await page.type("#password", process.env.LINKEDIN_PASS, { delay: 120 });
  await page.click('button[type="submit"]');
  await page.waitForNavigation();

  await page.goto("https://www.linkedin.com/feed/");
  await page.waitForSelector(".share-box-feed-entry__trigger");
  await page.click(".share-box-feed-entry__trigger");
  await page.waitForSelector(".ql-editor");

  await page.type(".ql-editor", post.content, { delay: 40 });
  await page.waitForSelector("button.share-actions__primary-action");
  await page.click("button.share-actions__primary-action");

  console.log("✅ Posted successfully to LinkedIn");
  await browser.close();
})();
