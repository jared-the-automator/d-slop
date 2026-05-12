import { parse } from 'node-html-parser';

// Matches straight double quotes (U+0022) and curly double quotes (U+201C/U+201D).
// Single quotes are intentionally excluded — curly apostrophes (U+2019) are identical
// to right single quotation marks, so using them as delimiters splits contractions.
const QUOTE_PATTERN = /["“”]([^"“”\n]{5,60})["“”]/g;

export function extractPhrasesFromHtml(html) {
  const root = parse(html);

  for (const el of root.querySelectorAll('nav, header, footer, script, style, aside')) {
    el.remove();
  }

  const phrases = new Set();

  for (const li of root.querySelectorAll('li')) {
    const text = li.text.trim().toLowerCase().replace(/["“”‘’']/g, '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 8 && !text.includes(':')) {
      phrases.add(text);
    }
  }

  const bodyText = root.text;
  for (const match of bodyText.matchAll(QUOTE_PATTERN)) {
    const phrase = match[1].toLowerCase().trim();
    const words = phrase.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 8) {
      phrases.add(phrase);
    }
  }

  return [...phrases].filter(Boolean);
}
