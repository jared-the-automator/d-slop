# D-slop Phase 2: Automated Rules Maintenance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build two GitHub Actions workflows that discover AI-slop phrase candidates weekly and validate them via Claude API, auto-committing confirmed changes to `rules.json`.

**Architecture:** `discover.yml` scrapes AI/human corpora and meta-articles, writes dated `candidates/YYYY-MM-DD.json`; `validate.yml` triggers on that commit, calls Claude to confirm each candidate, prunes stale phrases, bumps `rules.version`, and pushes to `main`. Two supporting Node.js scripts handle the logic; four pure library modules are TDD'd first.

**Tech Stack:** Node.js 20 ESM, Vitest, `@anthropic-ai/sdk`, `node-html-parser`, Brave Search API, GitHub Actions

---

## File Map

**Create:**
- `config/ai-sources.json` — curated AI-content URLs for frequency analysis
- `config/human-sources.json` — baseline human-writing URLs (Wikipedia)
- `config/discovery.json` — tunable thresholds and search queries
- `config/seen-urls.json` — rolling log of processed meta-article URLs
- `candidates/.gitkeep` — ensures directory is tracked
- `scripts/lib/ngrams.mjs` — pure n-gram extraction and frequency differential
- `scripts/lib/extract-phrases.mjs` — extract phrase candidates from HTML
- `scripts/lib/fetch-text.mjs` — fetch URL → clean text or raw HTML
- `scripts/lib/search.mjs` — Brave Search API wrapper
- `scripts/discover.mjs` — discovery orchestrator
- `scripts/validate.mjs` — validation orchestrator
- `tests/scripts/lib/ngrams.test.mjs` — unit tests for ngrams
- `tests/scripts/lib/extract-phrases.test.mjs` — unit tests for phrase extraction
- `.github/workflows/discover.yml`
- `.github/workflows/validate.yml`

**Modify:**
- `vitest.config.ts` — add `.mjs` to test include glob
- `package.json` — add `@anthropic-ai/sdk` and `node-html-parser` dependencies

---

## Task 1: Install dependencies and create config files

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Create: `config/ai-sources.json`, `config/human-sources.json`, `config/discovery.json`, `config/seen-urls.json`, `candidates/.gitkeep`

- [ ] **Step 1: Install npm dependencies**

```bash
cd /path/to/d-slop
source ~/.nvm/nvm.sh && nvm use 20
npm install @anthropic-ai/sdk node-html-parser
```

Expected: both packages added to `node_modules/` and `package-lock.json` updated.

- [ ] **Step 2: Extend vitest config to include `.mjs` test files**

Current `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

Replace with:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
  },
});
```

- [ ] **Step 3: Create `config/ai-sources.json`**

```json
[
  "https://blog.hubspot.com/marketing/content-marketing",
  "https://www.salesforce.com/blog/what-is-crm/",
  "https://www.mailchimp.com/resources/email-marketing-benchmarks/",
  "https://www.shopify.com/blog/ecommerce-marketing",
  "https://www.hootsuite.com/resources/social-media-strategy",
  "https://neilpatel.com/blog/content-marketing-strategy/",
  "https://www.semrush.com/blog/seo-strategy/",
  "https://www.optimizely.com/optimization-glossary/ab-testing/",
  "https://www.g2.com/categories/crm",
  "https://www.marketo.com/articles/what-is-marketing-automation/"
]
```

- [ ] **Step 4: Create `config/human-sources.json`**

```json
[
  "https://en.wikipedia.org/wiki/Marketing",
  "https://en.wikipedia.org/wiki/Content_marketing",
  "https://en.wikipedia.org/wiki/Search_engine_optimization",
  "https://en.wikipedia.org/wiki/Email_marketing",
  "https://en.wikipedia.org/wiki/Customer_relationship_management",
  "https://en.wikipedia.org/wiki/Social_media_marketing",
  "https://en.wikipedia.org/wiki/Digital_marketing",
  "https://en.wikipedia.org/wiki/Inbound_marketing",
  "https://en.wikipedia.org/wiki/Advertising",
  "https://en.wikipedia.org/wiki/Brand_management"
]
```

- [ ] **Step 5: Create `config/discovery.json`**

```json
{
  "searchQueries": [
    "AI writing patterns phrases to avoid",
    "ChatGPT phrases overused list",
    "AI slop words list",
    "LLM writing tells detect AI content",
    "how to spot AI generated text phrases"
  ],
  "frequencyMultiplier": 5,
  "minOccurrences": 3,
  "maxArticlesPerRun": 20
}
```

- [ ] **Step 6: Create `config/seen-urls.json`**

```json
[]
```

- [ ] **Step 7: Create `candidates/.gitkeep`**

```bash
mkdir -p candidates && touch candidates/.gitkeep
```

- [ ] **Step 8: Verify tests still pass**

```bash
npm test
```

Expected: existing rules-engine tests pass (scorer, signals).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts config/ candidates/.gitkeep
git commit -m "chore: add phase 2 dependencies and config files"
```

---

## Task 2: N-gram library (TDD)

**Files:**
- Create: `scripts/lib/ngrams.mjs`
- Create: `tests/scripts/lib/ngrams.test.mjs`

- [ ] **Step 1: Create test directory**

```bash
mkdir -p tests/scripts/lib
```

- [ ] **Step 2: Write failing tests**

Create `tests/scripts/lib/ngrams.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { extractNgrams, mergeNgramMaps, frequencyDiff } from '../../../scripts/lib/ngrams.mjs';

describe('extractNgrams', () => {
  it('extracts bigrams from text', () => {
    const result = extractNgrams('the quick brown fox', 2);
    expect(result.get('the quick')).toBe(1);
    expect(result.get('quick brown')).toBe(1);
    expect(result.get('brown fox')).toBe(1);
  });

  it('counts duplicate grams', () => {
    const result = extractNgrams('a b a b a', 2);
    expect(result.get('a b')).toBe(2);
    expect(result.get('b a')).toBe(2);
  });

  it('normalizes to lowercase', () => {
    const result = extractNgrams('Hello World', 2);
    expect(result.get('hello world')).toBe(1);
  });

  it('strips punctuation', () => {
    const result = extractNgrams('hello, world!', 2);
    expect(result.get('hello world')).toBe(1);
  });

  it('returns empty map for text shorter than n', () => {
    const result = extractNgrams('one', 2);
    expect(result.size).toBe(0);
  });
});

describe('mergeNgramMaps', () => {
  it('sums counts across multiple maps', () => {
    const a = new Map([['foo bar', 2]]);
    const b = new Map([['foo bar', 3], ['baz qux', 1]]);
    const merged = mergeNgramMaps([a, b]);
    expect(merged.get('foo bar')).toBe(5);
    expect(merged.get('baz qux')).toBe(1);
  });

  it('returns empty map for empty input', () => {
    expect(mergeNgramMaps([]).size).toBe(0);
  });
});

describe('frequencyDiff', () => {
  it('returns phrases overrepresented in AI corpus', () => {
    const aiText = 'delve into this topic delve into that delve into everything else around here now';
    const humanText = 'the cat sat on the mat and looked at the bird flying by';
    const result = frequencyDiff([aiText], [humanText], { multiplier: 3, minOccurrences: 2 });
    expect(result.some(p => p.includes('delve into'))).toBe(true);
  });

  it('does not return phrases equally common in both corpora', () => {
    const text = 'the quick brown fox jumps over the lazy dog once more';
    const result = frequencyDiff([text], [text], { multiplier: 5, minOccurrences: 1 });
    expect(result).toHaveLength(0);
  });

  it('returns empty array when either corpus is empty', () => {
    expect(frequencyDiff([], ['some human text here now'], { multiplier: 5, minOccurrences: 1 })).toHaveLength(0);
    expect(frequencyDiff(['some ai text here now'], [], { multiplier: 5, minOccurrences: 1 })).toHaveLength(0);
  });

  it('prefers longer phrases over subsumed shorter ones', () => {
    const aiText = 'delve into this topic delve into that delve into it'.repeat(5);
    const humanText = 'walked into the room walked into the hall walked into it'.repeat(5);
    const result = frequencyDiff([aiText], [humanText], { multiplier: 2, minOccurrences: 3 });
    const hasDelveInto = result.some(p => p === 'delve into');
    const hasDelveIntoThis = result.some(p => p === 'delve into this');
    if (hasDelveIntoThis) {
      expect(hasDelveInto).toBe(false);
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|Cannot find)"
```

Expected: FAIL — `Cannot find module '../../../scripts/lib/ngrams.mjs'`

- [ ] **Step 4: Create `scripts/lib/ngrams.mjs`**

```bash
mkdir -p scripts/lib
```

Create `scripts/lib/ngrams.mjs`:

```js
export function extractNgrams(text, n) {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  const counts = new Map();
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n).join(' ');
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

export function mergeNgramMaps(maps) {
  const merged = new Map();
  for (const map of maps) {
    for (const [gram, count] of map) {
      merged.set(gram, (merged.get(gram) ?? 0) + count);
    }
  }
  return merged;
}

export function frequencyDiff(aiTexts, humanTexts, { multiplier = 5, minOccurrences = 3 } = {}) {
  if (aiTexts.length === 0 || humanTexts.length === 0) return [];

  const aiTotalWords = aiTexts.join(' ').split(/\s+/).filter(Boolean).length;
  const humanTotalWords = humanTexts.join(' ').split(/\s+/).filter(Boolean).length;

  const candidates = [];

  for (const n of [2, 3, 4]) {
    const aiCombined = mergeNgramMaps(aiTexts.map(t => extractNgrams(t, n)));
    const humanCombined = mergeNgramMaps(humanTexts.map(t => extractNgrams(t, n)));

    for (const [gram, aiCount] of aiCombined) {
      if (aiCount < minOccurrences) continue;
      const humanCount = humanCombined.get(gram) ?? 0;
      const aiFreq = aiCount / aiTotalWords;
      const humanFreq = humanCount > 0 ? humanCount / humanTotalWords : 1e-6;
      if (aiFreq / humanFreq >= multiplier) {
        candidates.push(gram);
      }
    }
  }

  // Deduplicate, preferring longer phrases when a shorter one is subsumed
  const unique = [...new Set(candidates)];
  const sorted = unique.sort((a, b) => b.split(' ').length - a.split(' ').length);
  return sorted.filter((phrase, i) =>
    !sorted.slice(0, i).some(longer => longer.includes(phrase))
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|✓|×)"
```

Expected: all ngrams tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/ngrams.mjs tests/scripts/lib/ngrams.test.mjs
git commit -m "feat: add ngrams library with frequency differential"
```

---

## Task 3: Phrase extraction library (TDD)

**Files:**
- Create: `scripts/lib/extract-phrases.mjs`
- Create: `tests/scripts/lib/extract-phrases.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `tests/scripts/lib/extract-phrases.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { extractPhrasesFromHtml } from '../../../scripts/lib/extract-phrases.mjs';

describe('extractPhrasesFromHtml', () => {
  it('extracts phrases from short list items', () => {
    const html = '<ul><li>delve into</li><li>it is worth noting</li><li>in conclusion</li></ul>';
    const result = extractPhrasesFromHtml(html);
    expect(result).toContain('delve into');
    expect(result).toContain('it is worth noting');
    expect(result).toContain('in conclusion');
  });

  it('skips list items with more than 8 words', () => {
    const html = '<ul><li>this is a very long list item that has too many words in it</li></ul>';
    const result = extractPhrasesFromHtml(html);
    expect(result).toHaveLength(0);
  });

  it('skips single-word list items', () => {
    const html = '<ul><li>leverage</li></ul>';
    const result = extractPhrasesFromHtml(html);
    expect(result).toHaveLength(0);
  });

  it('extracts quoted phrases from paragraph text', () => {
    const html = '<p>ChatGPT often uses "let us explore" when opening a section.</p>';
    const result = extractPhrasesFromHtml(html);
    expect(result).toContain('let us explore');
  });

  it('extracts phrases from code blocks', () => {
    const html = '<pre><code>leverage synergies</code></pre>';
    const result = extractPhrasesFromHtml(html);
    expect(result).toContain('leverage synergies');
  });

  it('ignores content inside nav and footer', () => {
    const html = '<nav><ul><li>home page</li><li>about us</li></ul></nav><footer><p>site copyright notice</p></footer>';
    const result = extractPhrasesFromHtml(html);
    expect(result).toHaveLength(0);
  });

  it('returns deduplicated phrases', () => {
    const html = '<ul><li>delve into</li><li>delve into</li></ul>';
    const result = extractPhrasesFromHtml(html);
    expect(result.filter(p => p === 'delve into')).toHaveLength(1);
  });

  it('normalizes phrases to lowercase', () => {
    const html = '<ul><li>Delve Into</li></ul>';
    const result = extractPhrasesFromHtml(html);
    expect(result).toContain('delve into');
    expect(result).not.toContain('Delve Into');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|Cannot find)"
```

Expected: FAIL — `Cannot find module '../../../scripts/lib/extract-phrases.mjs'`

- [ ] **Step 3: Create `scripts/lib/extract-phrases.mjs`**

```js
import { parse } from 'node-html-parser';

const QUOTE_PATTERNS = [
  /["""'']([^"""''\n]{5,60})["""'']/g,
  /\b(?:phrases?|words?|terms?|says?|uses?|writes?)\s+["""'']([^"""''\n]{5,60})["""'']/gi,
];

export function extractPhrasesFromHtml(html) {
  const root = parse(html);

  for (const el of root.querySelectorAll('nav, header, footer, script, style, aside')) {
    el.remove();
  }

  const phrases = new Set();

  for (const li of root.querySelectorAll('li')) {
    const text = li.text.trim().toLowerCase().replace(/["""'']/g, '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 8 && !text.includes(':')) {
      phrases.add(text);
    }
  }

  for (const el of root.querySelectorAll('code, pre')) {
    const text = el.text.trim().toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 8) {
      phrases.add(text);
    }
  }

  const bodyText = root.text;
  for (const pattern of QUOTE_PATTERNS) {
    for (const match of bodyText.matchAll(pattern)) {
      const phrase = match[1].toLowerCase().trim();
      const words = phrase.split(/\s+/).filter(Boolean);
      if (words.length >= 2 && words.length <= 8) {
        phrases.add(phrase);
      }
    }
  }

  return [...phrases].filter(Boolean);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|PASS|✓|×)"
```

Expected: all extract-phrases tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass (rules-engine + ngrams + extract-phrases).

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/extract-phrases.mjs tests/scripts/lib/extract-phrases.test.mjs
git commit -m "feat: add phrase extraction library for meta-article parsing"
```

---

## Task 4: Fetch and search utilities

**Files:**
- Create: `scripts/lib/fetch-text.mjs`
- Create: `scripts/lib/search.mjs`

These modules wrap external I/O (network) — unit tests would require mocking `fetch`. Integration is verified when the discovery script runs end-to-end in Task 6.

- [ ] **Step 1: Create `scripts/lib/fetch-text.mjs`**

```js
import { parse } from 'node-html-parser';

export async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; d-slop-bot/1.0)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

export async function fetchText(url) {
  const html = await fetchHtml(url);
  const root = parse(html);
  for (const el of root.querySelectorAll('script, style, nav, header, footer, aside')) {
    el.remove();
  }
  return root.text.replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 2: Create `scripts/lib/search.mjs`**

```js
export async function braveSearch(queries, apiKey, seenUrls = []) {
  const seenSet = new Set(seenUrls);
  const newUrls = [];

  for (const query of queries) {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
    let data;
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        console.warn(`  Search failed for "${query}": HTTP ${res.status}`);
        continue;
      }
      data = await res.json();
    } catch (e) {
      console.warn(`  Search error for "${query}": ${e.message}`);
      continue;
    }

    for (const result of data?.web?.results ?? []) {
      if (result.url && !seenSet.has(result.url)) {
        newUrls.push(result.url);
        seenSet.add(result.url);
      }
    }
  }

  return { urls: newUrls, updatedSeen: [...seenSet] };
}
```

- [ ] **Step 3: Run full test suite to confirm nothing broken**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/fetch-text.mjs scripts/lib/search.mjs
git commit -m "feat: add fetch-text and Brave Search utilities"
```

---

## Task 5: Discovery orchestrator script

**Files:**
- Create: `scripts/discover.mjs`

- [ ] **Step 1: Create `scripts/discover.mjs`**

```js
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
const existingRules = readJson('rules/rules.json');
let seenUrls = readJson('config/seen-urls.json');

const existingPhrases = new Set(existingRules.signals.phraseMatch.phrases);
const allCandidates = new Map(); // phrase → { source, occurrences }

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
```

- [ ] **Step 2: Smoke-test the discovery script locally (no API key needed for basic structure check)**

```bash
source ~/.nvm/nvm.sh && nvm use 20
node --input-type=module <<'EOF'
import { readFileSync } from 'fs';
// Verify all imports resolve
import './scripts/lib/fetch-text.mjs';
import './scripts/lib/extract-phrases.mjs';
import './scripts/lib/ngrams.mjs';
import './scripts/lib/search.mjs';
console.log('All imports resolve OK');
EOF
```

Expected: `All imports resolve OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/discover.mjs
git commit -m "feat: add discovery orchestrator script"
```

---

## Task 6: Validation orchestrator script

**Files:**
- Create: `scripts/validate.mjs`

- [ ] **Step 1: Create `scripts/validate.mjs`**

```js
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const readJson = p => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const writeJson = (p, data) =>
  writeFileSync(resolve(ROOT, p), JSON.stringify(data, null, 2) + '\n');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Find latest candidates file
const candidateFiles = readdirSync(resolve(ROOT, 'candidates'))
  .filter(f => f.endsWith('.json') && f !== '.gitkeep')
  .sort()
  .reverse();

if (candidateFiles.length === 0) {
  console.log('No candidates files found. Exiting.');
  process.exit(0);
}

const { candidates } = readJson(`candidates/${candidateFiles[0]}`);
console.log(`Validating ${candidates.length} candidates from ${candidateFiles[0]}`);

const rules = readJson('rules/rules.json');
const currentPhrases = [...rules.signals.phraseMatch.phrases];

async function askClaude(prompt) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  try {
    return JSON.parse(text.match(/\{[\s\S]*?\}/)?.[0] ?? '{}');
  } catch {
    return {};
  }
}

// Step 1: Validate new candidates
console.log('\n--- Validating candidates ---');
const confirmed = [];
for (const { phrase } of candidates) {
  process.stdout.write(`  "${phrase}" ... `);
  const result = await askClaude(
    `Evaluate this phrase as an AI writing detector signal: "${phrase}"\n\n` +
    `Answer with JSON only: {"aiOverrepresented": true/false, "specificEnough": true/false}\n\n` +
    `- aiOverrepresented: true if this phrase appears in AI-generated content at noticeably higher rates than typical human writing\n` +
    `- specificEnough: true if this phrase is distinctive enough to be useful (not so generic it fires constantly on normal human prose)`
  );
  const passes = result.aiOverrepresented === true && result.specificEnough === true;
  console.log(passes ? '✓ confirmed' : '✗ rejected');
  if (passes) confirmed.push(phrase);
}

// Step 2: Staleness review of existing phrases
console.log('\n--- Reviewing existing phrases for staleness ---');
const stale = [];
for (const phrase of currentPhrases) {
  process.stdout.write(`  "${phrase}" ... `);
  const result = await askClaude(
    `Is the phrase "${phrase}" now so common in general human writing that it's no longer a reliable AI detector signal?\n\n` +
    `Answer with JSON only: {"stale": true/false}`
  );
  const isStale = result.stale === true;
  console.log(isStale ? 'stale' : 'ok');
  if (isStale) stale.push(phrase);
}

// Step 3: Apply changes
if (confirmed.length === 0 && stale.length === 0) {
  console.log('\nNo changes needed. Exiting.');
  process.exit(0);
}

const prevVersion = rules.version;
rules.signals.phraseMatch.phrases = [
  ...currentPhrases.filter(p => !stale.includes(p)),
  ...confirmed,
];
rules.version = prevVersion + 1;
writeJson('rules/rules.json', rules);

console.log(`\nRules updated: v${prevVersion} → v${rules.version}`);
console.log(`  +${confirmed.length} added: ${confirmed.join(', ') || 'none'}`);
console.log(`  -${stale.length} removed: ${stale.join(', ') || 'none'}`);
console.log(`  Total phrases: ${rules.signals.phraseMatch.phrases.length}`);
```

- [ ] **Step 2: Verify the script imports resolve**

```bash
source ~/.nvm/nvm.sh && nvm use 20
node --input-type=module <<'EOF'
import Anthropic from '@anthropic-ai/sdk';
console.log('Anthropic SDK imports OK:', typeof Anthropic);
EOF
```

Expected: `Anthropic SDK imports OK: function`

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/validate.mjs
git commit -m "feat: add validation orchestrator script (Claude API dual-gate)"
```

---

## Task 7: GitHub Actions — discover.yml

**Files:**
- Create: `.github/workflows/discover.yml`

- [ ] **Step 1: Create `.github/workflows/` directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create `.github/workflows/discover.yml`**

```yaml
name: Discover Phrase Candidates

on:
  schedule:
    - cron: '0 0 * * 0'   # Every Sunday at 00:00 UTC
  workflow_dispatch:

jobs:
  discover:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run discovery
        env:
          BRAVE_SEARCH_API_KEY: ${{ secrets.BRAVE_SEARCH_API_KEY }}
        run: node scripts/discover.mjs

      - name: Commit candidates and updated seen-urls
        run: |
          git config user.name "d-slop-bot"
          git config user.email "bot@d-slop"
          git add candidates/ config/seen-urls.json
          if git diff --cached --quiet; then
            echo "No new candidates to commit."
          else
            git commit -m "chore(discovery): add candidates $(date -u +%Y-%m-%d)"
            git push
          fi

      - name: Summary
        if: always()
        run: |
          echo "## Discovery Run" >> $GITHUB_STEP_SUMMARY
          CAND=$(ls candidates/*.json 2>/dev/null | tail -1)
          if [ -n "$CAND" ]; then
            COUNT=$(node -e "const f=require('fs');const d=JSON.parse(f.readFileSync('$CAND'));console.log(d.candidates.length)")
            echo "- Candidates written: $COUNT" >> $GITHUB_STEP_SUMMARY
            echo "- File: $CAND" >> $GITHUB_STEP_SUMMARY
          else
            echo "- No candidates file written (0 candidates found)" >> $GITHUB_STEP_SUMMARY
          fi
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/discover.yml
git commit -m "ci: add discover workflow (weekly Sunday cron + manual trigger)"
```

---

## Task 8: GitHub Actions — validate.yml

**Files:**
- Create: `.github/workflows/validate.yml`

- [ ] **Step 1: Create `.github/workflows/validate.yml`**

```yaml
name: Validate Phrase Candidates

on:
  push:
    paths:
      - 'candidates/**.json'
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run validation
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: node scripts/validate.mjs

      - name: Commit rules update
        run: |
          git config user.name "d-slop-bot"
          git config user.email "bot@d-slop"
          git add rules/rules.json
          if git diff --cached --quiet; then
            echo "No rules changes to commit."
          else
            VERSION=$(node -e "const r=require('./rules/rules.json');console.log(r.version)")
            COUNT=$(node -e "const r=require('./rules/rules.json');console.log(r.signals.phraseMatch.phrases.length)")
            git commit -m "chore(rules): auto-update to v${VERSION} (${COUNT} phrases) [skip ci]"
            git push
          fi

      - name: Summary
        if: always()
        run: |
          echo "## Validation Run" >> $GITHUB_STEP_SUMMARY
          VERSION=$(node -e "const r=require('./rules/rules.json');console.log(r.version)" 2>/dev/null || echo "unknown")
          COUNT=$(node -e "const r=require('./rules/rules.json');console.log(r.signals.phraseMatch.phrases.length)" 2>/dev/null || echo "unknown")
          echo "- rules.json version: $VERSION" >> $GITHUB_STEP_SUMMARY
          echo "- Total phrases: $COUNT" >> $GITHUB_STEP_SUMMARY
```

Note: `[skip ci]` in the commit message prevents the validate workflow from re-triggering on the `rules/rules.json` push (validate only watches `candidates/`, but it's good hygiene).

- [ ] **Step 2: Add `ANTHROPIC_API_KEY` and `BRAVE_SEARCH_API_KEY` as GitHub Actions secrets**

In the GitHub repository:
1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add `ANTHROPIC_API_KEY` with your Anthropic API key
4. Add `BRAVE_SEARCH_API_KEY` with your Brave Search API key (free tier at [brave.com/search/api](https://brave.com/search/api))

- [ ] **Step 3: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit and push**

```bash
git add .github/workflows/validate.yml
git commit -m "ci: add validate workflow (triggers on candidates push)"
git push
```

- [ ] **Step 5: Verify workflows appear in GitHub Actions tab**

Open `https://github.com/jared-the-automator/d-slop/actions` — both "Discover Phrase Candidates" and "Validate Phrase Candidates" should appear in the workflow list.

- [ ] **Step 6: Trigger a manual discovery run to smoke-test end-to-end**

In GitHub Actions → "Discover Phrase Candidates" → "Run workflow" → Run. Check the run log for any errors. If discovery produces candidates, the validate workflow will trigger automatically.
