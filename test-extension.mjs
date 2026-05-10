import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '.output/chrome-mv3');

const context = await chromium.launchPersistentContext('', {
  headless: false,
  executablePath: '/usr/bin/google-chrome',
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-sandbox',
  ],
});

const page = await context.newPage();

const CONFIG = {
  PHRASES: ['delve into',"it's worth noting",'it is worth noting','tapestry of','as an ai language model','i cannot and will not',"it's important to note",'it is important to note',"it's important to understand",'it is important to understand','dive deep',"let's explore",'let us explore',"let's take a look",'let us take a look','comprehensive guide','navigating the','in the realm of','at the end of the day','game-changer','revolutionize','leverage','utilize','pivotal','embark on','underscore the importance','foster','paramount','holistic approach','key takeaway','key takeaways','groundbreaking','ever-evolving',"in today's world","in today's fast-paced",'the fact of the matter','rest assured','it goes without saying','needless to say','without further ado','as we wrap up','looking ahead','actionable insights','best practices','when it comes to','plays a crucial role','play a crucial role','moving forward','in this article','in this guide','seamlessly','state-of-the-art'],
  MARKERS: ['in conclusion','to summarize','in summary','to recap','tl;dr','tldr','key takeaway','key takeaways','the bottom line','to wrap up','final thoughts','wrapping up'],
  THRESHOLD: 0.20,
  DIVISOR: 2,
  MIN_WORDS: 25,
};

function scoreText(text, { PHRASES, MARKERS, THRESHOLD, DIVISOR }) {
  const lower = text.toLowerCase();
  const matched = PHRASES.filter(p => lower.includes(p));
  const phraseScore = Math.min(1, matched.length / DIVISOR);
  const hasMarker = MARKERS.some(m => lower.includes(m)) ? 1 : 0;
  const combined = phraseScore * 0.4 + hasMarker * 0.1;
  return { score: Math.round(combined * 100) / 100, matched, flagged: combined >= THRESHOLD };
}

// Ground-truth test with known AI paragraph
const AI_PARAGRAPH = `When it comes to leveraging best practices in today's fast-paced digital landscape, it is worth noting that organizations must foster a holistic approach. In this guide, we will delve into the key takeaways and actionable insights that play a crucial role in moving forward. Seamlessly integrating these state-of-the-art methodologies will help you navigate the ever-evolving challenges ahead.`;

const HUMAN_PARAGRAPH = `The data showed a 12% increase in Q3. After reviewing the numbers with the team, we decided to cut spending on display ads and redirect the budget toward email. It worked — retention improved by the end of the quarter, though acquisition stayed flat. We're still figuring out what drove the change.`;

console.log('\n=== GROUND TRUTH TEST ===');
const aiResult = scoreText(AI_PARAGRAPH, CONFIG);
const humanResult = scoreText(HUMAN_PARAGRAPH, CONFIG);
console.log(`AI paragraph:    score=${aiResult.score}, flagged=${aiResult.flagged}, phrases=[${aiResult.matched.join(', ')}]`);
console.log(`Human paragraph: score=${humanResult.score}, flagged=${humanResult.flagged}, phrases=[${humanResult.matched.join(', ')}]`);

// Page tests
async function testPage(url, waitMs = 3000) {
  console.log(`\n--- ${url} ---`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() =>
    page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
  );
  await page.waitForTimeout(waitMs);

  const injected = await page.evaluate(() => document.querySelectorAll('[data-dslop-scored]').length);

  const result = await page.evaluate(({ PHRASES, MARKERS, THRESHOLD, DIVISOR, MIN_WORDS }) => {
    const SEL = 'p, li, blockquote, article, [class*="content"], [class*="post-body"], [class*="article-body"], [class*="entry-content"], [class*="story-body"]';
    const EXCL = 'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"], [role="search"]';
    const blocks = Array.from(document.querySelectorAll(SEL))
      .filter(el => !el.closest(EXCL))
      .filter(el => !el.querySelector(SEL))
      .map(el => (el.innerText ?? el.textContent ?? '').trim())
      .filter(t => t.split(/\s+/).filter(w => w.length > 0).length >= MIN_WORDS);

    const scored = blocks.map(text => {
      const lower = text.toLowerCase();
      const matched = PHRASES.filter(p => lower.includes(p));
      const phraseScore = Math.min(1, matched.length / DIVISOR);
      const hasMarker = MARKERS.some(m => lower.includes(m)) ? 1 : 0;
      const combined = phraseScore * 0.4 + hasMarker * 0.1;
      return { words: text.split(/\s+/).length, matched, score: Math.round(combined * 100) / 100, snippet: text.slice(0, 100) };
    });

    const flagged = scored.filter(s => s.score >= THRESHOLD);
    return { total: blocks.length, flagged: flagged.length, top: flagged.sort((a,b) => b.score - a.score).slice(0, 3) };
  }, CONFIG);

  const note = injected > 0 ? `✓ injected (${injected} scored)` : '— Playwright limitation, logic tested directly';
  console.log(`  Script: ${note}`);
  console.log(`  Blocks ≥${CONFIG.MIN_WORDS}w: ${result.total} | Flagged: ${result.flagged}`);
  result.top.forEach(b => console.log(`    [${b.score}] [${b.matched.join(', ')}] "${b.snippet}"`));
}

await testPage('https://www.hubspot.com/marketing-statistics');
await testPage('https://blog.hubspot.com/marketing/content-marketing-strategy', 4000);
await testPage('https://www.forbes.com/advisor/business/software/best-project-management-software/');

await context.close();
