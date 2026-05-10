import { getExtensionState, getCachedRules, setFlagCount } from '../lib/storage';
import { score } from '../lib/rules-engine/scorer';
import type { DisplayMode, TextScore } from '../lib/rules-engine/types';

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

function applyHidden(el: Element): void {
  (el as HTMLElement).style.display = 'none';
}

function applyMode(el: Element, textScore: TextScore, mode: DisplayMode): void {
  if (mode === 'highlight') applyHighlight(el, textScore);
  else if (mode === 'collapse') applyCollapse(el);
  else applyHidden(el);
}

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    let tabFlagCount = 0;

    async function run() {
      const [state, rules] = await Promise.all([getExtensionState(), getCachedRules()]);

      if (!state.enabled) return;

      const blocks = getTextBlocks();
      let flagCount = 0;

      for (const block of blocks) {
        block.setAttribute(SCORED_ATTR, '1');
        const text = (block as HTMLElement).innerText ?? block.textContent ?? '';
        const textScore = score(text, rules);
        if (textScore.flagged) {
          applyMode(block, textScore, state.mode);
          flagCount++;
        }
      }

      await setFlagCount(flagCount);
      tabFlagCount = flagCount;
    }

    await run();

    browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg?.type === 'GET_FLAG_COUNT') {
        sendResponse({ count: tabFlagCount });
        return true;
      }
    });
  },
});
