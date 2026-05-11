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
