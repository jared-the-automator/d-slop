import { getExtensionState, getCachedRules, setFlagCount, getUserThreshold, getMediaSettings } from '../lib/storage';
import { score } from '../lib/rules-engine/scorer';
import type { DisplayMode, TextScore } from '../lib/rules-engine/types';
import { getMediaElements, MEDIA_SCANNED_ATTR } from '../lib/media-detector/scanner';
import { applyMediaMode } from '../lib/media-detector/renderer';
import type { MediaDetectionResult } from '../lib/media-detector/types';

const SCORED_ATTR = 'data-dslop-scored';
const BADGE_CLASS = 'dslop-badge';

const CONTENT_SELECTORS = [
  'p', 'li', 'blockquote', 'article',
  '[class*="content"]', '[class*="post-body"]',
  '[class*="article-body"]', '[class*="entry-content"]',
  '[class*="story-body"]',
].join(', ');

const EXCLUDE_ANCESTORS = 'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"], [role="search"]';

function getTextBlocks(): Element[] {
  return Array.from(document.querySelectorAll(CONTENT_SELECTORS))
    .filter(el => !el.closest(EXCLUDE_ANCESTORS))
    .filter(el => !el.querySelector(CONTENT_SELECTORS))
    .filter(el => !el.hasAttribute(SCORED_ATTR))
    .filter(el => {
      const text = (el as HTMLElement).innerText ?? el.textContent ?? '';
      return text.trim().split(/\s+/).filter(w => w.length > 0).length >= 25;
    });
}

function applyHighlight(el: Element, textScore: TextScore): void {
  const pct = Math.round(textScore.score * 100);
  (el as HTMLElement).style.outline = '2px solid rgba(255, 140, 0, 0.55)';
  (el as HTMLElement).style.outlineOffset = '3px';
  (el as HTMLElement).style.position = 'relative';

  const badge = document.createElement('span');
  badge.className = BADGE_CLASS;
  badge.textContent = `AI ~${pct}%`;
  badge.style.cssText = [
    'position:absolute',
    'top:0',
    'right:0',
    'background:rgba(255,140,0,0.85)',
    'color:#000',
    'font:bold 10px/1 monospace',
    'padding:2px 5px',
    'border-radius:0 0 0 4px',
    'z-index:2147483647',
    'pointer-events:none',
  ].join(';');
  el.appendChild(badge);
}

function applyCollapse(el: Element): void {
  const wrapper = document.createElement('details');
  wrapper.style.cssText = 'border:1px solid #bbb;border-radius:3px;margin:4px 0;padding:2px 6px';

  const summary = document.createElement('summary');
  summary.textContent = 'likely AI-generated — click to reveal';
  summary.style.cssText = 'cursor:pointer;color:#999;font-size:0.85em;padding:4px 0';

  if (!el.parentNode) return;
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(summary);
  wrapper.appendChild(el);
}

function applyFullPageOverlay(flagCount: number): void {
  if (document.getElementById('dslop-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'dslop-overlay';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:#540D6E',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-family:monospace',
  ].join(';');

  const box = document.createElement('div');
  box.style.cssText = 'color:#9FFCDF;text-align:center;max-width:380px;padding:2em';

  const title = document.createElement('p');
  title.style.cssText = 'font-size:1.3em;margin:0 0 0.4em;font-weight:bold';
  title.textContent = 'AI-generated content detected';

  const sub = document.createElement('p');
  sub.style.cssText = 'font-size:0.85em;margin:0 0 1.5em;opacity:0.75';
  sub.textContent = `${flagCount} block${flagCount !== 1 ? 's' : ''} flagged on this page`;

  const countdown = document.createElement('p');
  let remaining = 3;
  countdown.style.cssText = 'font-size:0.8em;margin:0 0 1em;opacity:0.6';
  countdown.textContent = `Returning in ${remaining}s…`;

  const btn = document.createElement('button');
  btn.textContent = 'Show anyway';
  btn.style.cssText = [
    'background:#9FFCDF',
    'color:#540D6E',
    'border:none',
    'padding:0.5em 1.4em',
    'font:bold 0.95em monospace',
    'cursor:pointer',
    'border-radius:4px',
  ].join(';');

  const tick = setInterval(() => {
    remaining -= 1;
    countdown.textContent = `Returning in ${remaining}s…`;
  }, 1000);

  const goBack = setTimeout(() => {
    clearInterval(tick);
    history.back();
  }, 3000);

  btn.addEventListener('click', () => {
    clearInterval(tick);
    clearTimeout(goBack);
    overlay.remove();
  });

  box.appendChild(title);
  box.appendChild(sub);
  box.appendChild(countdown);
  box.appendChild(btn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function applyMode(el: Element, textScore: TextScore, mode: DisplayMode): void {
  if (mode === 'highlight') applyHighlight(el, textScore);
  else if (mode === 'collapse') applyCollapse(el);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    let tabFlagCount = 0;

    async function runMediaScan(): Promise<number> {
      const state = await getExtensionState();
      if (!state.enabled) return 0;
      const mediaSettings = await getMediaSettings();
      const elements = getMediaElements();
      let count = 0;

      for (const el of elements) {
        el.setAttribute(MEDIA_SCANNED_ATTR, '1');
        const src = el.getAttribute('src');
        if (!src) continue;

        let result: MediaDetectionResult;
        try {
          result = await browser.runtime.sendMessage({ type: 'SCAN_MEDIA', url: src });
        } catch {
          continue;
        }

        if (!result?.detected) continue;
        count++;
        if (mediaSettings.mode !== 'hidden') {
          applyMediaMode(el, result, mediaSettings.mode);
        }
      }

      return count;
    }

    async function run() {
      const [state, rules, userThreshold] = await Promise.all([
        getExtensionState(),
        getCachedRules(),
        getUserThreshold(),
      ]);
      if (!state.enabled) return;

      const effectiveRules = { ...rules, threshold: userThreshold };
      const blocks = getTextBlocks();
      let textFlagCount = 0;

      for (const block of blocks) {
        block.setAttribute(SCORED_ATTR, '1');
        const text = (block as HTMLElement).innerText ?? block.textContent ?? '';
        const textScore = score(text, effectiveRules);
        if (textScore.flagged) {
          if (state.mode !== 'hidden') applyMode(block, textScore, state.mode);
          textFlagCount++;
        }
      }

      const mediaFlagCount = await runMediaScan();
      const flagCount = textFlagCount + mediaFlagCount;

      await setFlagCount(flagCount);
      tabFlagCount = flagCount;

      if (state.mode === 'hidden' && flagCount > 0) {
        applyFullPageOverlay(flagCount);
      }
    }

    await run();

    const observer = new MutationObserver(() => { runMediaScan(); });
    observer.observe(document.body, { childList: true, subtree: true });

    browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'GET_FLAG_COUNT') {
        sendResponse({ count: tabFlagCount });
        return true;
      }
    });
  },
});
