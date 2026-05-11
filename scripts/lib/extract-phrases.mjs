import { parse } from 'node-html-parser';

const QUOTE_PATTERNS = [
  /["""'']([^"""''\n]{5,60})["""'']/g,
  /\b(?:phrases?|words?|terms?|says?|uses?|writes?)\s+["""'']([^"""''\n]{5,60})["""'']/gi,
];

function getAllElements(node, tagNames) {
  const results = [];
  const tags = new Set(tagNames.toLowerCase().split(/\s*,\s*/));

  function traverse(el) {
    if (el.nodeType === 1 && tags.has(el.rawTagName?.toLowerCase())) {
      results.push(el);
    }
    if (el.childNodes) {
      for (const child of el.childNodes) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return results;
}

export function extractPhrasesFromHtml(html) {
  const root = parse(html);

  // Remove navigation and footer elements
  const toRemove = getAllElements(root, 'nav, header, footer, script, style, aside');
  for (const el of toRemove) {
    el.remove();
  }

  const phrases = new Set();

  // Extract from list items
  const listItems = getAllElements(root, 'li');
  for (const li of listItems) {
    const text = li.text.trim().toLowerCase().replace(/["""'']/g, '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 8 && !text.includes(':')) {
      phrases.add(text);
    }
  }

  // Extract from code/pre blocks using regex on original HTML
  // This handles edge cases where parser doesn't properly parse nested tags
  const codeMatches = html.match(/<(?:code|pre)[^>]*>([^<]+)<\/(?:code|pre)>/gi);
  if (codeMatches) {
    for (const match of codeMatches) {
      const text = match.replace(/<[^>]+>/g, '').trim().toLowerCase();
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length >= 2 && words.length <= 8) {
        phrases.add(text);
      }
    }
  }

  // Extract quoted phrases from paragraph text
  const bodyText = root.text;
  for (const pattern of QUOTE_PATTERNS) {
    for (const match of bodyText.matchAll(pattern)) {
      const phrase = match[1].toLowerCase().trim();
      const words = phrase.split(/\s+/).filter(Boolean);
      if (words.length >= 2 && words.length <= 8) {
        phrases.add(phrase);
      }
    }
  }

  return [...phrases].filter(Boolean);
}
