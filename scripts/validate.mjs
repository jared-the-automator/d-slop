import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const readJson = p => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const writeJson = (p, data) =>
  writeFileSync(resolve(ROOT, p), JSON.stringify(data, null, 2) + '\n');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is not set');
  process.exit(1);
}

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

async function askClaude(prompt, maxTokens = 2048) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  try {
    return JSON.parse(text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)?.[0] ?? '[]');
  } catch {
    return [];
  }
}

function sanitizePhrase(phrase) {
  return phrase
    .replace(/[\n\r\t"\\{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

// Step 1: Validate all candidates in a single batch call
console.log('\n--- Validating candidates (batch) ---');
const sanitizedCandidates = candidates
  .map(({ phrase }) => sanitizePhrase(phrase))
  .filter(p => p && p.length >= 3);

const confirmed = [];
if (sanitizedCandidates.length > 0) {
  const candidateList = sanitizedCandidates.map((p, i) => `${i}: ${p}`).join('\n');
  const results = await askClaude(
    `Evaluate each phrase below as an AI writing detector signal.\n\n` +
    `For each phrase, determine:\n` +
    `- aiOverrepresented: true if this phrase appears in AI-generated content at noticeably higher rates than typical human writing\n` +
    `- specificEnough: true if this phrase is distinctive enough to be useful (not so generic it fires constantly on normal human prose)\n\n` +
    `Phrases:\n${candidateList}\n\n` +
    `Return a JSON array with one object per phrase in the same order:\n` +
    `[{"aiOverrepresented": true/false, "specificEnough": true/false}, ...]`
  );

  const resultArray = Array.isArray(results) ? results : [];
  sanitizedCandidates.forEach((phrase, i) => {
    const r = resultArray[i] ?? {};
    const passes = r.aiOverrepresented === true && r.specificEnough === true;
    console.log(`  "${phrase}" ... ${passes ? '✓ confirmed' : '✗ rejected'}`);
    if (passes) confirmed.push(phrase);
  });
} else {
  console.log('  No valid candidates to evaluate.');
}

// Step 2: Staleness review of all existing phrases in a single batch call
console.log('\n--- Reviewing existing phrases for staleness (batch) ---');
const stale = [];
if (currentPhrases.length > 0) {
  const phraseList = currentPhrases.map((p, i) => `${i}: ${sanitizePhrase(p)}`).join('\n');
  const stalenessResults = await askClaude(
    `Review each phrase below for staleness as an AI writing detector signal.\n\n` +
    `A phrase is stale if it has become so common in general human writing that it's no longer a reliable AI indicator.\n\n` +
    `Phrases:\n${phraseList}\n\n` +
    `Return a JSON array with one object per phrase in the same order:\n` +
    `[{"stale": true/false}, ...]`
  );

  const stalenessArray = Array.isArray(stalenessResults) ? stalenessResults : [];
  currentPhrases.forEach((phrase, i) => {
    const r = stalenessArray[i] ?? {};
    const isStale = r.stale === true;
    console.log(`  "${sanitizePhrase(phrase)}" ... ${isStale ? 'stale' : 'ok'}`);
    if (isStale) stale.push(phrase);
  });
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
