import { parse } from 'node-html-parser';

const QUOTE_PATTERN = /["""'']([^"""''\n]{5,60})["""'']/g;

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
    // Re-parse the innerHTML to get proper nested structure
    const innerContent = el.innerHTML;
    const parsed = parse(innerContent);
    const text = parsed.text.trim().toLowerCase();
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 8) {
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
