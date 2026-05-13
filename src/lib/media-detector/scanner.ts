export const MEDIA_SCANNED_ATTR = 'data-dslop-media-scanned';

const MEDIA_SELECTORS = 'img[src], video[src], audio[src]';
const EXCLUDE_ANCESTORS = [
  'nav', 'header', 'footer', 'aside',
  '[role="navigation"]', '[role="banner"]',
  '[role="complementary"]', '[role="search"]',
].join(', ');

export function getMediaElements(): Element[] {
  return Array.from(document.querySelectorAll(MEDIA_SELECTORS))
    .filter(el => !el.closest(EXCLUDE_ANCESTORS))
    .filter(el => !el.hasAttribute(MEDIA_SCANNED_ATTR))
    .filter(el => {
      const src = el.getAttribute('src') ?? '';
      return src.length > 0 && !src.startsWith('data:') && !src.startsWith('blob:');
    });
}
