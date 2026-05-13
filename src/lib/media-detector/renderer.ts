import type { MediaDetectionResult } from './types';
import type { DisplayMode } from '../rules-engine/types';

const BADGE_CLASS = 'dslop-media-badge';
const PLACEHOLDER_CLASS = 'dslop-media-placeholder';

export function applyMediaHighlight(el: Element, result: MediaDetectionResult): void {
  const label = result.tool ? `C2PA: ${result.tool}` : 'C2PA: AI-generated';
  (el as HTMLElement).style.outline = '2px solid rgba(255, 140, 0, 0.55)';
  (el as HTMLElement).style.outlineOffset = '3px';

  const wrapper = (el as HTMLElement).parentElement;
  if (!wrapper) return;

  const badge = document.createElement('span');
  badge.className = BADGE_CLASS;
  badge.textContent = label;
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

  const posParent = document.createElement('span');
  posParent.style.cssText = 'position:relative;display:inline-block';
  el.parentNode!.insertBefore(posParent, el);
  posParent.appendChild(el);
  posParent.appendChild(badge);
}

export function applyMediaCollapse(el: Element): void {
  const htmlEl = el as HTMLElement;
  const width = htmlEl.offsetWidth || 300;
  const height = htmlEl.offsetHeight || 200;

  const placeholder = document.createElement('div');
  placeholder.className = PLACEHOLDER_CLASS;
  placeholder.style.cssText = [
    `width:${width}px`,
    `height:${height}px`,
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'background:#1a0332',
    'border:1px solid rgba(255,140,0,0.4)',
    'border-radius:4px',
    'gap:8px',
  ].join(';');

  const label = document.createElement('span');
  label.style.cssText = 'color:#9FFCDF;font:bold 11px/1 monospace';
  label.textContent = 'AI-generated media';

  const link = document.createElement('button');
  link.textContent = 'Show anyway';
  link.style.cssText = [
    'background:transparent',
    'border:1px solid rgba(159,252,223,0.5)',
    'color:#9FFCDF',
    'font:10px/1 monospace',
    'padding:3px 8px',
    'cursor:pointer',
    'border-radius:3px',
  ].join(';');

  link.addEventListener('click', () => {
    placeholder.replaceWith(el);
  });

  placeholder.appendChild(label);
  placeholder.appendChild(link);
  el.parentNode!.insertBefore(placeholder, el);
  el.remove();
}

export function applyMediaMode(el: Element, result: MediaDetectionResult, mode: DisplayMode): void {
  if (mode === 'highlight') applyMediaHighlight(el, result);
  else if (mode === 'collapse') applyMediaCollapse(el);
  // 'hidden' is handled at the page level in content.ts
}
