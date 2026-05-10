import { describe, it, expect } from 'vitest';
import { score } from '../../src/lib/rules-engine/scorer';
import type { Rules } from '../../src/lib/rules-engine/types';

const TEST_RULES: Rules = {
  version: 1,
  threshold: 0.35,
  signals: {
    phraseMatch: {
      weight: 0.40,
      phrases: ['delve into', 'key takeaways', 'in conclusion', 'it is worth noting'],
    },
    burstiness: { weight: 0.25, uniformityThreshold: 0.35 },
    punctuationDensity: { weight: 0.15, densityThreshold: 0.04 },
    listUniformity: { weight: 0.10, varianceThreshold: 0.25 },
    conclusionMarkers: {
      weight: 0.10,
      markers: ['in conclusion', 'to summarize', 'key takeaways'],
    },
  },
};

const HUMAN_TEXT = `
The dog ran across the yard and barked at the fence.
She looked up from her book, startled.
Rain had been falling all morning — quietly, without thunder — and the streets were slick.
He made coffee.
The argument the night before still sat unresolved between them like furniture neither wanted to move.
They ate breakfast without speaking, and when she left he stood at the window watching her car disappear around the corner.
It occurred to him that he had no idea what came next.
`.repeat(3);

const AI_TEXT = `
It is worth noting that in today's rapidly evolving landscape, organizations must delve into the key takeaways
from recent developments in artificial intelligence. The key takeaways from this analysis are clear and actionable.
In conclusion, it is paramount that stakeholders leverage these insights to foster meaningful change.
Businesses must utilize best practices to embark on their digital transformation journey.
The holistic approach outlined here provides a comprehensive guide to navigating these challenges.
At the end of the day, actionable insights and key takeaways drive sustainable growth and leverage competitive advantage.
`.repeat(2);

describe('score', () => {
  it('returns score 0 and flagged false for text under 25 words', () => {
    const result = score('This is a short text.', TEST_RULES);
    expect(result.score).toBe(0);
    expect(result.flagged).toBe(false);
    expect(result.signals).toHaveLength(0);
  });

  it('returns all five signal names for text >= 25 words', () => {
    const result = score(HUMAN_TEXT, TEST_RULES);
    const names = result.signals.map(s => s.name);
    expect(names).toContain('phraseMatch');
    expect(names).toContain('burstiness');
    expect(names).toContain('punctuationDensity');
    expect(names).toContain('listUniformity');
    expect(names).toContain('conclusionMarkers');
  });

  it('returns score >= 0 for normal text', () => {
    const result = score(HUMAN_TEXT, TEST_RULES);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('flags AI-like text', () => {
    const result = score(AI_TEXT, TEST_RULES);
    expect(result.flagged).toBe(true);
  });

  it('does not flag clearly human text', () => {
    const result = score(HUMAN_TEXT, TEST_RULES);
    expect(result.flagged).toBe(false);
  });

  it('score equals the weighted sum of signal scores', () => {
    const result = score(AI_TEXT, TEST_RULES);
    const expectedSum = result.signals.reduce((sum, s) => sum + s.score * s.weight, 0);
    expect(result.score).toBeCloseTo(expectedSum, 5);
  });

  it('flagged is true when score >= threshold', () => {
    const result = score(AI_TEXT, TEST_RULES);
    expect(result.flagged).toBe(result.score >= TEST_RULES.threshold);
  });
});
