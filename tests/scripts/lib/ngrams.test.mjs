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
    const result = frequencyDiff([aiText], [humanText], { multiplier: 2, minOccurrences: 2 });
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
    const aiText = ('delve into this topic delve into that delve into it '.repeat(5)).trim();
    const humanText = ('walked into the room walked into the hall walked into it '.repeat(5)).trim();
    const result = frequencyDiff([aiText], [humanText], { multiplier: 2, minOccurrences: 3 });
    const hasDelveIntoThisTopic = result.some(p => p === 'delve into this topic');
    expect(hasDelveIntoThisTopic).toBe(true);
    const hasDelveInto = result.some(p => p === 'delve into');
    expect(hasDelveInto).toBe(false);
  });
});
