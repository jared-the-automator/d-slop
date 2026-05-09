import { describe, it, expect } from 'vitest';
import {
  phraseMatchScore,
  conclusionMarkerScore,
  sentenceUniformityScore,
  punctuationDensityScore,
  listUniformityScore,
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

describe('sentenceUniformityScore', () => {
  it('returns 0 for fewer than 3 sentences', () => {
    expect(sentenceUniformityScore('Hello world. This is two sentences.', 0.35)).toBe(0);
  });

  it('returns high score for uniform sentence lengths (AI-like)', () => {
    const uniform = [
      'This sentence has approximately ten words in the total.',
      'Here is another sentence that also has ten words here.',
      'And yet another sentence with exactly ten words right now.',
      'One more sentence that also has ten words in it.',
      'The final sentence here also has about ten words too.',
    ].join(' ');
    expect(sentenceUniformityScore(uniform, 0.35)).toBeGreaterThan(0.5);
  });

  it('returns low score for varied sentence lengths (human-like)', () => {
    const varied = [
      'Short.',
      'This is a much much longer sentence that goes on and on for quite a while with many many words.',
      'Brief.',
      'Another very long sentence here that contains many additional words to increase the variance significantly.',
      'Ok.',
    ].join(' ');
    expect(sentenceUniformityScore(varied, 0.35)).toBeLessThan(0.3);
  });
});

describe('punctuationDensityScore', () => {
  it('returns 0 for text with no em-dashes or semicolons', () => {
    expect(punctuationDensityScore('The cat sat on the mat. It looked around.', 0.04)).toBe(0);
  });

  it('returns > 0 for text with em-dashes', () => {
    const text = 'The results — which were surprising — showed a clear trend — pointing toward a new direction.';
    expect(punctuationDensityScore(text, 0.04)).toBeGreaterThan(0);
  });

  it('returns > 0 for text with semicolons', () => {
    const text = 'First point; second point; third point; fourth point; fifth item here.';
    expect(punctuationDensityScore(text, 0.04)).toBeGreaterThan(0);
  });

  it('caps at 1.0', () => {
    const text = '— ; — ; — ; — ; — ; — ; — ; — ; — ; — ;';
    expect(punctuationDensityScore(text, 0.04)).toBeLessThanOrEqual(1.0);
  });
});

describe('listUniformityScore', () => {
  it('returns 0 for text with fewer than 3 list items', () => {
    const text = '- Item one here\n- Item two here';
    expect(listUniformityScore(text, 0.25)).toBe(0);
  });

  it('returns high score for highly uniform list items', () => {
    const text = [
      '- Improve your communication skills today',
      '- Develop your leadership abilities now',
      '- Enhance your technical knowledge base',
      '- Strengthen your analytical thinking here',
      '- Expand your professional network widely',
    ].join('\n');
    expect(listUniformityScore(text, 0.25)).toBeGreaterThan(0.5);
  });

  it('returns low score for varied list items', () => {
    const text = [
      '- Yes',
      '- This is a much much much longer list item with many many words in it that goes on',
      '- Ok',
      '- Another extremely verbose list entry that just keeps going and going with tons of words',
      '- No',
    ].join('\n');
    expect(listUniformityScore(text, 0.25)).toBeLessThan(0.3);
  });

  it('returns 0 when no list items found', () => {
    expect(listUniformityScore('Just a normal paragraph with no list formatting here.', 0.25)).toBe(0);
  });
});
