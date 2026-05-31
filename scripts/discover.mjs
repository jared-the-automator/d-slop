import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchText, fetchHtml } from './lib/fetch-text.mjs';
import { extractPhrasesFromHtml } from './lib/extract-phrases.mjs';
import { frequencyDiff } from './lib/ngrams.mjs';
import { braveSearch } from './lib/search.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const readJson = p => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const writeJson = (p, data) =>
  writeFileSync(resolve(ROOT, p), JSON.stringify(data, null, 2) + '\n');

const config = readJson('config/discovery.json');
const aiSourceUrls = readJson('config/ai-sources.json');
const humanSourceUrls = readJson('config/human-sources.json');
const existingRules = (() => {
  try { return readJson('rules/rules.json'); } catch { return { signals: { phraseMatch: { phrases: [] } } }; }
})();
let seenUrls = (() => {
  try { return readJson('config/seen-urls.json'); } catch { return []; }
})();

const existingPhrases = new Set(existingRules.signals.phraseMatch.phrases);
const allCandidates = new Map(); // phrase → { source, occurrences }

if (!process.env.BRAVE_SEARCH_API_KEY) {
  console.error('Error: BRAVE_SEARCH_API_KEY environment variable is not set');
  process.exit(1);
}

// Step 1: Web search + meta-article extraction
console.log('Searching for meta-articles...');
const { urls: metaUrls, updatedSeen } = await braveSearch(
  config.searchQueries,
  process.env.BRAVE_SEARCH_API_KEY,
  seenUrls
);
seenUrls = updatedSeen;
console.log(`Found ${metaUrls.length} new article URLs`);

for (const url of metaUrls.slice(0, config.maxArticlesPerRun)) {
  try {
    const html = await fetchHtml(url);
    const phrases = extractPhrasesFromHtml(html);
    for (const phrase of phrases) {
      if (!existingPhrases.has(phrase)) {
        const existing = allCandidates.get(phrase);
        allCandidates.set(phrase, {
          source: existing?.source ?? url,
          occurrences: (existing?.occurrences ?? 0) + 1,
        });
      }
    }
    console.log(`  ✓ ${url} (${phrases.length} phrases)`);
  } catch (e) {
    console.warn(`  Skipped ${url}: ${e.message}`);
  }
}

// Step 2: Frequency differential
console.log('\nScraping AI corpus...');
const aiTexts = [];
for (const url of aiSourceUrls) {
  try {
    aiTexts.push(await fetchText(url));
    console.log(`  ✓ ${url}`);
  } catch (e) {
    console.warn(`  Skipped ${url}: ${e.message}`);
  }
}

console.log('Scraping human corpus...');
const humanTexts = [];
for (const url of humanSourceUrls) {
  try {
    humanTexts.push(await fetchText(url));
    console.log(`  ✓ ${url}`);
  } catch (e) {
    console.warn(`  Skipped ${url}: ${e.message}`);
  }
}

if (aiTexts.length > 0 && humanTexts.length > 0) {
  const diffCandidates = frequencyDiff(aiTexts, humanTexts, {
    multiplier: config.frequencyMultiplier,
    minOccurrences: config.minOccurrences,
  });
  console.log(`\nFrequency diff: ${diffCandidates.length} candidates`);
  for (const phrase of diffCandidates) {
    if (!existingPhrases.has(phrase) && !allCandidates.has(phrase)) {
      allCandidates.set(phrase, { source: 'frequency-differential', occurrences: 1 });
    }
  }
}

// Step 3: Write output
const candidateList = [...allCandidates.entries()]
  .map(([phrase, meta]) => ({ phrase, ...meta }));

if (candidateList.length === 0) {
  console.log('\nNo new candidates found. Exiting.');
  process.exit(0);
}

const date = new Date().toISOString().split('T')[0];
const outPath = resolve(ROOT, `candidates/${date}.json`);
mkdirSync(resolve(ROOT, 'candidates'), { recursive: true });
writeFileSync(outPath, JSON.stringify({ date, candidates: candidateList }, null, 2) + '\n');
console.log(`\nWrote ${candidateList.length} candidates → candidates/${date}.json`);

// Step 4: Update seen-urls (cap at 500)
writeJson('config/seen-urls.json', seenUrls.slice(-500));
console.log(`Updated seen-urls.json (${seenUrls.length} entries)`);
