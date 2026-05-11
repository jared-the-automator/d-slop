import { parse } from 'node-html-parser';

export async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; d-slop-bot/1.0)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

export async function fetchText(url) {
  const html = await fetchHtml(url);
  const root = parse(html);
  for (const el of root.querySelectorAll('script, style, nav, header, footer, aside')) {
    el.remove();
  }
  return root.text.replace(/\s+/g, ' ').trim();
}
