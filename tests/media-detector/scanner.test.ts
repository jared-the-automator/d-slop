// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getMediaElements, MEDIA_SCANNED_ATTR } from '../../src/lib/media-detector/scanner';

beforeEach(() => {
  document.body.replaceChildren();
});

function el(tag: string, attrs: Record<string, string> = {}): Element {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  document.body.appendChild(e);
  return e;
}

describe('getMediaElements', () => {
  it('returns empty array when no media present', () => {
    expect(getMediaElements()).toHaveLength(0);
  });

  it('returns img elements with src', () => {
    el('img', { src: 'https://example.com/photo.jpg' });
    expect(getMediaElements()).toHaveLength(1);
  });

  it('returns video elements with src', () => {
    el('video', { src: 'https://example.com/clip.mp4' });
    expect(getMediaElements()).toHaveLength(1);
  });

  it('returns audio elements with src', () => {
    el('audio', { src: 'https://example.com/track.mp3' });
    expect(getMediaElements()).toHaveLength(1);
  });

  it('excludes elements without src', () => {
    el('img');
    expect(getMediaElements()).toHaveLength(0);
  });

  it('excludes data: URL elements', () => {
    el('img', { src: 'data:image/png;base64,abc' });
    expect(getMediaElements()).toHaveLength(0);
  });

  it('excludes already-scanned elements', () => {
    el('img', { src: 'https://example.com/photo.jpg', [MEDIA_SCANNED_ATTR]: '1' });
    expect(getMediaElements()).toHaveLength(0);
  });

  it('excludes elements inside nav', () => {
    const nav = document.createElement('nav');
    const img = document.createElement('img');
    img.setAttribute('src', 'https://example.com/photo.jpg');
    nav.appendChild(img);
    document.body.appendChild(nav);
    expect(getMediaElements()).toHaveLength(0);
  });
});
