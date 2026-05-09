import { describe, it, expect } from 'vitest';
import {
  phraseMatchScore,
  conclusionMarkerScore,
} from '../../src/lib/rules-engine/signals';

describe('phraseMatchScore', () => {
  it('returns 0 when phrase list is empty', () => {
    expect(phraseMatchScore('The quick brown fox jumps over the lazy dog.', [])).toBe(0);
  });

  it('returns 0 when text has no matching phrases', () => {
    expect(phraseMatchScore('The cat sat on the mat and looked at the wall.', ['delve into'])).toBe(0);
  });

  it('returns > 0 when text contains a matching phrase', () => {
    const score = phraseMatchScore(
      'Let us delve into the matter at hand and examine the evidence.',
      ['delve into'],
    );
    expect(score).toBeGreaterThan(0);
  });

  it('returns higher score for more phrase matches', () => {
    const oneMatch = phraseMatchScore(
      'Let us delve into the topic carefully.',
      ['delve into', 'key takeaways', 'in conclusion'],
    );
    const threeMatches = phraseMatchScore(
      'Let us delve into the key takeaways. In conclusion, this matters.',
      ['delve into', 'key takeaways', 'in conclusion'],
    );
    expect(threeMatches).toBeGreaterThan(oneMatch);
  });

  it('caps at 1.0', () => {
    const text = 'delve into tapestry of it is worth noting in conclusion to summarize leverage utilize pivotal foster';
    const phrases = ['delve into', 'tapestry of', 'it is worth noting', 'in conclusion', 'to summarize', 'leverage', 'utilize', 'pivotal', 'foster'];
    expect(phraseMatchScore(text, phrases)).toBeLessThanOrEqual(1.0);
  });

  it('is case-insensitive', () => {
    const lower = phraseMatchScore('let us delve into this.', ['delve into']);
    const upper = phraseMatchScore('LET US DELVE INTO THIS.', ['delve into']);
    expect(lower).toBeCloseTo(upper);
  });
});

describe('conclusionMarkerScore', () => {
  it('returns 0 when no markers present', () => {
    expect(conclusionMarkerScore('The data shows an interesting pattern here.', ['in conclusion'])).toBe(0);
  });

  it('returns 1 when a marker is present', () => {
    expect(conclusionMarkerScore('In conclusion, the results are clear.', ['in conclusion'])).toBe(1);
  });

  it('returns 1 for any marker in the list', () => {
    expect(conclusionMarkerScore('TL;DR: it works.', ['tl;dr', 'in conclusion'])).toBe(1);
  });

  it('is case-insensitive', () => {
    expect(conclusionMarkerScore('IN CONCLUSION, this is done.', ['in conclusion'])).toBe(1);
  });
});
