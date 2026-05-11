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
    return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
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
