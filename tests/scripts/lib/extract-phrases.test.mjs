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

  it('skips list items containing a colon', () => {
    const html = '<ul><li>tools: how to use them</li></ul>';
    const result = extractPhrasesFromHtml(html);
    expect(result).toHaveLength(0);
  });

  it('skips quoted phrases shorter than 5 characters', () => {
    const html = '<p>avoid "hi"</p>';
    const result = extractPhrasesFromHtml(html);
    expect(result).toHaveLength(0);
  });

  it('does not split on curly apostrophes as quote delimiters', () => {
    // ’ = RIGHT SINGLE QUOTATION MARK (same codepoint as curly apostrophe)
    // “/” = LEFT/RIGHT DOUBLE QUOTATION MARK
    const html = "<p>Don’t use “in conclusion” or “to summarize”.</p>";
    const result = extractPhrasesFromHtml(html);
    expect(result).toContain('in conclusion');
    expect(result).toContain('to summarize');
    expect(result.find(p => p.startsWith('t use'))).toBeUndefined();
  });
});
