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

async function testPage(url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() =>
    page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
  );
  await page.waitForTimeout(2500);

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
      return { matched, score: Math.round(combined * 100) / 100 };
    });
    const flagged = scored.filter(s => s.score >= THRESHOLD);
    return { total: blocks.length, flagged: flagged.length, phrases: [...new Set(flagged.flatMap(s => s.matched))] };
  }, CONFIG);

  const pct = result.total ? Math.round(result.flagged / result.total * 100) : 0;
  console.log(`${result.flagged}/${result.total} (${pct}%)  [${result.phrases.join(', ')}]`);
  console.log(`  ${url}`);
}

const URLS = [
  'https://blog.hubspot.com/marketing/content-marketing',
  'https://www.salesforce.com/blog/what-is-crm/',
  'https://www.marketo.com/articles/what-is-marketing-automation/',
  'https://www.mailchimp.com/resources/email-marketing-benchmarks/',
  'https://www.shopify.com/blog/ecommerce-marketing',
  'https://www.hootsuite.com/resources/social-media-strategy',
  'https://buffer.com/resources/social-media-marketing-strategy/',
  'https://neilpatel.com/blog/content-marketing-strategy/',
  'https://www.semrush.com/blog/seo-strategy/',
  'https://www.wordstream.com/blog/ws/2021/03/16/digital-marketing-strategy',
];

console.log('flags/blocks (%)  [matched phrases]');
console.log('---');
for (const url of URLS) {
  await testPage(url).catch(() => console.log(`  ERROR: ${url}`));
}

await context.close();
