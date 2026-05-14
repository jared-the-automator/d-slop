# D-slop Phase 3: AI Media Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend D-slop to detect AI-generated images, video, and audio using C2PA provenance metadata, with per-channel user settings.

**Architecture:** Add a media detection pipeline alongside the existing text pipeline. A background service worker handler fetches media bytes (bypassing CORS), a pure TypeScript C2PA UUID scanner detects provenance manifests, and a renderer applies highlight/collapse/hidden to flagged elements. Per-channel settings (text vs media) share the same mode/threshold shape but are stored independently.

**Tech Stack:** WXT browser extension framework, TypeScript, Vitest, chrome.runtime.sendMessage for content→background messaging, chrome.storage.local for settings.

---

## File Map

**Create:**
- `src/lib/media-detector/types.ts` — shared interfaces
- `src/lib/media-detector/c2pa.ts` — C2PA byte scanner
- `src/lib/media-detector/scanner.ts` — DOM element finder
- `src/lib/media-detector/renderer.ts` — applies highlight/collapse to flagged elements
- `tests/media-detector/c2pa.test.ts`
- `tests/media-detector/scanner.test.ts`

**Modify:**
- `src/lib/config.ts` — add MEDIA_MODE_KEY, MEDIA_THRESHOLD_KEY, TIER_KEY, DEFAULT_MEDIA_THRESHOLD
- `src/lib/storage.ts` — add getMediaSettings, setMediaSettings, getTier
- `src/entrypoints/background.ts` — add SCAN_MEDIA message handler
- `src/entrypoints/content.ts` — add runMediaScan + MutationObserver
- `src/entrypoints/popup/App.tsx` — split into Text + Media sections

---

### Task 1: Types, Config, and Storage

**Files:**
- Create: `src/lib/media-detector/types.ts`
- Modify: `src/lib/config.ts`
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/media-detector/types.ts
export interface MediaDetectionResult {
  detected: boolean;
  method?: string;
  tool?: string;
}

export interface MediaDetector {
  name: string;
  detect(url: string): Promise<MediaDetectionResult>;
}

export interface MediaSettings {
  mode: 'highlight' | 'collapse' | 'hidden';
  threshold: number;
}
```

- [ ] **Step 2: Add config constants**

Add to the bottom of `src/lib/config.ts`:

```typescript
export const MEDIA_MODE_KEY = 'mediaMode';
export const MEDIA_THRESHOLD_KEY = 'mediaThreshold';
export const TIER_KEY = 'tier';
export const DEFAULT_MEDIA_THRESHOLD = 0.5;
export const DEFAULT_MEDIA_MODE: 'highlight' | 'collapse' | 'hidden' = 'highlight';
```

- [ ] **Step 3: Add storage helpers**

Add to `src/lib/storage.ts` (after existing functions):

```typescript
import {
  MEDIA_MODE_KEY, MEDIA_THRESHOLD_KEY, TIER_KEY,
  DEFAULT_MEDIA_THRESHOLD, DEFAULT_MEDIA_MODE,
} from './config';
import type { MediaSettings } from './media-detector/types';

export async function getMediaSettings(): Promise<MediaSettings> {
  const result = await chrome.storage.local.get([MEDIA_MODE_KEY, MEDIA_THRESHOLD_KEY]);
  return {
    mode: (result[MEDIA_MODE_KEY] as MediaSettings['mode']) ?? DEFAULT_MEDIA_MODE,
    threshold: (result[MEDIA_THRESHOLD_KEY] as number) ?? DEFAULT_MEDIA_THRESHOLD,
  };
}

export async function setMediaSettings(settings: Partial<MediaSettings>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (settings.mode !== undefined) patch[MEDIA_MODE_KEY] = settings.mode;
  if (settings.threshold !== undefined) patch[MEDIA_THRESHOLD_KEY] = settings.threshold;
  await chrome.storage.local.set(patch);
}

export async function getTier(): Promise<'free' | 'plus'> {
  const result = await chrome.storage.local.get([TIER_KEY]);
  return (result[TIER_KEY] as 'free' | 'plus') ?? 'free';
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/media-detector/types.ts src/lib/config.ts src/lib/storage.ts
git commit -m "feat(media): add types, config keys, and storage helpers for media detection"
```

---

### Task 2: C2PA Byte Scanner (TDD)

**Files:**
- Create: `src/lib/media-detector/c2pa.ts`
- Create: `tests/media-detector/c2pa.test.ts`

The C2PA JUMBF UUID is `CA 7A 7A 7A 00 00 11 00 80 00 00 AA 00 38 9B 71`. Detection is binary — if that UUID appears in the first 200KB of the file, AI provenance is declared.

Known-tool extraction scans for the `tool.name` field in the JUMBF JSON payload near the UUID.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/media-detector/c2pa.test.ts
import { describe, it, expect } from 'vitest';
import { scanForC2PA } from '../../src/lib/media-detector/c2pa';

const C2PA_UUID = new Uint8Array([
  0xCA,0x7A,0x7A,0x7A,0x00,0x00,0x11,0x00,
  0x80,0x00,0x00,0xAA,0x00,0x38,0x9B,0x71,
]);

function makeBytesWithUuid(toolName?: string): Uint8Array {
  const prefix = new Uint8Array(32).fill(0x00);
  const suffix = new Uint8Array(32).fill(0xFF);
  const toolBytes = toolName
    ? new TextEncoder().encode(JSON.stringify({ 'tool.name': toolName }))
    : new Uint8Array(0);
  const out = new Uint8Array(prefix.length + C2PA_UUID.length + toolBytes.length + suffix.length);
  out.set(prefix, 0);
  out.set(C2PA_UUID, prefix.length);
  out.set(toolBytes, prefix.length + C2PA_UUID.length);
  out.set(suffix, prefix.length + C2PA_UUID.length + toolBytes.length);
  return out;
}

describe('scanForC2PA', () => {
  it('returns detected:false for empty bytes', () => {
    expect(scanForC2PA(new Uint8Array(0))).toEqual({ detected: false });
  });

  it('returns detected:false when UUID absent', () => {
    expect(scanForC2PA(new Uint8Array(64).fill(0x00))).toEqual({ detected: false });
  });

  it('returns detected:true when UUID present without tool name', () => {
    const result = scanForC2PA(makeBytesWithUuid());
    expect(result.detected).toBe(true);
    expect(result.method).toBe('C2PA');
    expect(result.tool).toBeUndefined();
  });

  it('returns detected:true with tool name when present', () => {
    const result = scanForC2PA(makeBytesWithUuid('Adobe Firefly'));
    expect(result.detected).toBe(true);
    expect(result.method).toBe('C2PA');
    expect(result.tool).toBe('Adobe Firefly');
  });

  it('extracts known tool names', () => {
    const knownTools = ['Adobe Firefly', 'DALL-E', 'Midjourney', 'Stable Diffusion', 'Bing Image Creator', 'Microsoft Designer'];
    for (const tool of knownTools) {
      const result = scanForC2PA(makeBytesWithUuid(tool));
      expect(result.tool).toBe(tool);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run tests/media-detector/c2pa.test.ts 2>&1 | tail -15
```

Expected: FAIL with "Cannot find module" or similar.

- [ ] **Step 3: Implement the C2PA scanner**

```typescript
// src/lib/media-detector/c2pa.ts
import type { MediaDetectionResult } from './types';

const C2PA_UUID = new Uint8Array([
  0xCA,0x7A,0x7A,0x7A,0x00,0x00,0x11,0x00,
  0x80,0x00,0x00,0xAA,0x00,0x38,0x9B,0x71,
]);

const KNOWN_TOOLS = [
  'Adobe Firefly', 'DALL-E', 'Midjourney', 'Stable Diffusion',
  'Bing Image Creator', 'Microsoft Designer',
];

function findUuid(bytes: Uint8Array): number {
  const limit = bytes.length - C2PA_UUID.length;
  outer: for (let i = 0; i <= limit; i++) {
    for (let j = 0; j < C2PA_UUID.length; j++) {
      if (bytes[i + j] !== C2PA_UUID[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function extractToolName(bytes: Uint8Array, uuidIdx: number): string | undefined {
  const start = uuidIdx + C2PA_UUID.length;
  const end = Math.min(start + 512, bytes.length);
  const slice = bytes.slice(start, end);
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(slice);
    for (const tool of KNOWN_TOOLS) {
      if (text.includes(tool)) return tool;
    }
    const match = text.match(/"tool\.name"\s*:\s*"([^"]{1,80})"/);
    if (match) return match[1];
  } catch {
    // non-UTF-8 payload — no tool name recoverable
  }
  return undefined;
}

export function scanForC2PA(bytes: Uint8Array): MediaDetectionResult {
  const idx = findUuid(bytes);
  if (idx === -1) return { detected: false };
  return { detected: true, method: 'C2PA', tool: extractToolName(bytes, idx) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run tests/media-detector/c2pa.test.ts 2>&1 | tail -15
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/media-detector/c2pa.ts tests/media-detector/c2pa.test.ts
git commit -m "feat(media): implement C2PA UUID byte scanner with TDD"
```

---

### Task 3: DOM Scanner (TDD)

**Files:**
- Create: `src/lib/media-detector/scanner.ts`
- Create: `tests/media-detector/scanner.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/media-detector/scanner.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run tests/media-detector/scanner.test.ts 2>&1 | tail -15
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement the DOM scanner**

```typescript
// src/lib/media-detector/scanner.ts
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
      return src.length > 0 && !src.startsWith('data:');
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npx vitest run tests/media-detector/scanner.test.ts 2>&1 | tail -15
```

Expected: 8 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npm test 2>&1 | tail -10
```

Expected: all tests pass (49 existing + 13 new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/media-detector/scanner.ts tests/media-detector/scanner.test.ts
git commit -m "feat(media): implement DOM media element scanner with TDD"
```

---

### Task 4: Media Renderer

**Files:**
- Create: `src/lib/media-detector/renderer.ts`

No unit tests — renderer manipulates DOM with inline styles; covered by smoke test in Task 8.

- [ ] **Step 1: Create the renderer**

```typescript
// src/lib/media-detector/renderer.ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/media-detector/renderer.ts
git commit -m "feat(media): add media renderer (highlight, collapse, hidden-passthrough)"
```

---

### Task 5: Background Service Worker — SCAN_MEDIA Handler

**Files:**
- Modify: `src/entrypoints/background.ts`

- [ ] **Step 1: Read the current background.ts**

Read `src/entrypoints/background.ts` to see its current structure before editing.

- [ ] **Step 2: Add the SCAN_MEDIA handler**

Import the C2PA scanner and add a message handler inside the existing `defineBackground()` call. The handler fetches the first 200KB of the media URL and scans for C2PA bytes. Adding it alongside any existing message handling:

```typescript
import { scanForC2PA } from '../lib/media-detector/c2pa';
import type { MediaDetectionResult } from '../lib/media-detector/types';

// Inside defineBackground(), alongside any existing listeners:
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'SCAN_MEDIA') return;
  const url: string = msg.url;
  fetch(url, {
    headers: { Range: 'bytes=0-204799' },
    signal: AbortSignal.timeout(5000),
  })
    .then(res => {
      if (!res.ok) return sendResponse({ detected: false } as MediaDetectionResult);
      return res.arrayBuffer().then(buf => {
        sendResponse(scanForC2PA(new Uint8Array(buf)));
      });
    })
    .catch(() => sendResponse({ detected: false } as MediaDetectionResult));
  return true; // keep message channel open for async sendResponse
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/entrypoints/background.ts
git commit -m "feat(media): add SCAN_MEDIA handler in background service worker"
```

---

### Task 6: Content Script — Media Scan + MutationObserver

**Files:**
- Modify: `src/entrypoints/content.ts`

- [ ] **Step 1: Read the current content.ts**

Read `src/entrypoints/content.ts` lines 1–185 to see the existing structure.

- [ ] **Step 2: Add imports and runMediaScan**

Add these imports at the top of `content.ts`:

```typescript
import { getMediaSettings } from '../lib/storage';
import { getMediaElements, MEDIA_SCANNED_ATTR } from '../lib/media-detector/scanner';
import { applyMediaMode } from '../lib/media-detector/renderer';
import type { MediaDetectionResult } from '../lib/media-detector/types';
```

Add the `runMediaScan` function inside the `main()` body, before `run()`:

```typescript
async function runMediaScan(): Promise<number> {
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
```

- [ ] **Step 3: Integrate into run() and add MutationObserver**

Refactor the `run()` function to run both scans in parallel, and add a MutationObserver for lazy-loaded media. Replace the existing `run()` call and listener block:

```typescript
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

// Watch for lazily-loaded media elements
const observer = new MutationObserver(() => { runMediaScan(); });
observer.observe(document.body, { childList: true, subtree: true });

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'GET_FLAG_COUNT') {
    sendResponse({ count: tabFlagCount });
    return true;
  }
});
```

- [ ] **Step 4: Run full test suite**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/content.ts
git commit -m "feat(media): integrate media scan + MutationObserver into content script"
```

---

### Task 7: Popup UI — Text + Media Sections

**Files:**
- Modify: `src/entrypoints/popup/App.tsx`

- [ ] **Step 1: Read the current App.tsx**

Read `src/entrypoints/popup/App.tsx` to review all current state and JSX.

- [ ] **Step 2: Rewrite App.tsx with Text and Media sections**

```tsx
import { useState, useEffect } from 'react';
import {
  getExtensionState, setExtensionState,
  getUserThreshold, setUserThreshold,
  getMediaSettings, setMediaSettings, getTier,
} from '../../lib/storage';
import { DEFAULT_THRESHOLD, DEFAULT_MEDIA_THRESHOLD } from '../../lib/config';
import type { DisplayMode, ExtensionState } from '../../lib/rules-engine/types';
import type { MediaSettings } from '../../lib/media-detector/types';

const MODES: DisplayMode[] = ['highlight', 'collapse', 'hidden'];

const sectionStyle = {
  border: '1px solid #ccc',
  borderRadius: 4,
  padding: '5px 10px 8px',
  marginBottom: 10,
};

const legendStyle = { fontSize: 11, color: '#888', padding: '0 3px' };

export default function App() {
  const [state, setState] = useState<ExtensionState>({ enabled: true, mode: 'highlight' });
  const [flagCount, setFlagCountLocal] = useState(0);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [mediaSettings, setMediaSettingsLocal] = useState<MediaSettings>({
    mode: 'highlight',
    threshold: DEFAULT_MEDIA_THRESHOLD,
  });
  const [tier, setTier] = useState<'free' | 'plus'>('free');

  useEffect(() => {
    getExtensionState().then(setState);
    getUserThreshold().then(setThreshold);
    getMediaSettings().then(setMediaSettingsLocal);
    getTier().then(setTier);
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id) return;
      browser.tabs.sendMessage(tab.id, { type: 'GET_FLAG_COUNT' })
        .then((res: { count: number }) => setFlagCountLocal(res?.count ?? 0))
        .catch(() => setFlagCountLocal(0));
    });
  }, []);

  async function toggleEnabled() {
    const next = !state.enabled;
    await setExtensionState({ enabled: next });
    setState(s => ({ ...s, enabled: next }));
  }

  async function pickTextMode(mode: DisplayMode) {
    await setExtensionState({ mode });
    setState(s => ({ ...s, mode }));
  }

  async function changeThreshold(value: number) {
    await setUserThreshold(value);
    setThreshold(value);
  }

  async function pickMediaMode(mode: DisplayMode) {
    await setMediaSettings({ mode });
    setMediaSettingsLocal(s => ({ ...s, mode }));
  }

  async function changeMediaThreshold(value: number) {
    await setMediaSettings({ threshold: value });
    setMediaSettingsLocal(s => ({ ...s, threshold: value }));
  }

  const dimmed = { opacity: state.enabled ? 1 : 0.4 };

  return (
    <div style={{ width: 220, padding: '12px 14px', fontFamily: 'monospace', fontSize: 13, color: '#222' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>D-slop</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={state.enabled} onChange={toggleEnabled} style={{ cursor: 'pointer' }} />
          <span style={{ color: state.enabled ? '#2a9d2a' : '#999' }}>
            {state.enabled ? 'ON' : 'OFF'}
          </span>
        </label>
      </div>

      {/* Text section */}
      <fieldset style={{ ...sectionStyle, ...dimmed }}>
        <legend style={legendStyle}>Text</legend>
        {MODES.map(m => (
          <label key={m} style={{ display: 'block', margin: '3px 0', cursor: state.enabled ? 'pointer' : 'default' }}>
            <input
              type="radio" name="textMode" value={m}
              checked={state.mode === m} disabled={!state.enabled}
              onChange={() => pickTextMode(m)}
              style={{ marginRight: 6 }}
            />
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </label>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 6, marginBottom: 2 }}>
          <span>sensitive</span>
          <span style={{ color: '#555', fontWeight: threshold === DEFAULT_THRESHOLD ? 'bold' : 'normal' }}>
            {Math.round(threshold * 100)}%{threshold === DEFAULT_THRESHOLD ? ' (default)' : ''}
          </span>
          <span>strict</span>
        </div>
        <input
          type="range" min="0.05" max="0.50" step="0.05"
          value={threshold} disabled={!state.enabled}
          onChange={e => changeThreshold(Number(e.target.value))}
          style={{ width: '100%', cursor: state.enabled ? 'pointer' : 'default' }}
        />
      </fieldset>

      {/* Media section */}
      <fieldset style={{ ...sectionStyle, ...dimmed }}>
        <legend style={legendStyle}>Media</legend>
        {MODES.map(m => (
          <label key={m} style={{ display: 'block', margin: '3px 0', cursor: state.enabled ? 'pointer' : 'default' }}>
            <input
              type="radio" name="mediaMode" value={m}
              checked={mediaSettings.mode === m} disabled={!state.enabled}
              onChange={() => pickMediaMode(m)}
              style={{ marginRight: 6 }}
            />
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </label>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 6, marginBottom: 2 }}>
          <span>sensitive</span>
          <span style={{ color: '#555', fontWeight: mediaSettings.threshold === DEFAULT_MEDIA_THRESHOLD ? 'bold' : 'normal' }}>
            {Math.round(mediaSettings.threshold * 100)}%{mediaSettings.threshold === DEFAULT_MEDIA_THRESHOLD ? ' (default)' : ''}
          </span>
          <span>strict</span>
        </div>
        <input
          type="range" min="0.05" max="1.00" step="0.05"
          value={mediaSettings.threshold} disabled={!state.enabled}
          onChange={e => changeMediaThreshold(Number(e.target.value))}
          style={{ width: '100%', cursor: state.enabled ? 'pointer' : 'default' }}
        />
        <p style={{ fontSize: 10, color: '#888', margin: '5px 0 0 0' }}>
          C2PA scanning active
          {tier === 'free' && (
            <span style={{ marginLeft: 6, color: '#9b59b6' }}>· D-slop+</span>
          )}
        </p>
      </fieldset>

      <div style={{ fontSize: 11, color: '#999', textAlign: 'right' }}>
        {state.enabled
          ? `${flagCount} item${flagCount !== 1 ? 's' : ''} flagged this page`
          : 'detection off'}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run full test suite**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/entrypoints/popup/App.tsx
git commit -m "feat(media): split popup into Text and Media sections with per-channel controls"
```

---

### Task 8: Build, Smoke Test, and Repackage

**Files:**
- No new files — build and test

- [ ] **Step 1: Build the extension**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && npm run build 2>&1 | tail -15
```

Expected: build succeeds with no errors.

- [ ] **Step 2: Verify output structure**

```bash
ls /home/biggerfisch/.gemini/antigravity/d-slop/.output/chrome-mv3/
```

Expected: `manifest.json`, `background.js`, `content-scripts/`, `popup/`, and related assets present.

- [ ] **Step 3: Load in Chrome and smoke test**

Manual steps (cannot automate):
1. Open `chrome://extensions`, enable Developer mode, click "Load unpacked"
2. Select `.output/chrome-mv3/`
3. Navigate to `https://contentcredentials.org/verify` — this site hosts known C2PA-signed images
4. Verify that flagged images receive orange outline + "C2PA: AI-generated" badge in highlight mode
5. Switch media mode to collapse — verify flagged images are replaced with placeholder + "Show anyway" button
6. Click "Show anyway" — verify original image is restored
7. Verify text detection still works on a news site (no regression)
8. Open popup — verify Text and Media sections both appear with independent controls

- [ ] **Step 4: Repackage as v0.2.0**

```bash
cd /home/biggerfisch/.gemini/antigravity/d-slop && source ~/.nvm/nvm.sh && nvm use 22 && zip -r d-slop-chrome-v0.2.0.zip .output/chrome-mv3/ && echo "Done"
```

Expected: `d-slop-chrome-v0.2.0.zip` created.

- [ ] **Step 5: Final commit**

```bash
git add d-slop-chrome-v0.2.0.zip
git commit -m "feat(media): Phase 3 complete — C2PA media detection, per-channel settings, v0.2.0"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| MediaDetector / MediaDetectionResult interfaces | Task 1 |
| C2PA provider (UUID scan, method, tool name) | Task 2 |
| DOM scanner (img/video/audio, excludes nav/data:/already-scanned) | Task 3 |
| Renderer: highlight (orange outline + badge) | Task 4 |
| Renderer: collapse (placeholder, "Show anyway") | Task 4 |
| Renderer: hidden (full-page overlay, existing logic) | Task 6 (delegated to existing applyFullPageOverlay) |
| CORS bypass via background service worker | Task 5 |
| 5-second timeout, 200KB fetch limit | Task 5 |
| MutationObserver for lazy-loaded media | Task 6 |
| Per-channel settings (text vs media) | Task 1 (storage), Task 7 (UI) |
| Tier field (free/plus), defaulting to free | Task 1 |
| D-slop+ placeholder link in popup | Task 7 |
| "C2PA scanning active" status line | Task 7 |
| 404 elements skipped | Task 5 (res.ok check → detected:false) |
| Threshold reserved for future API providers | Documented in spec; threshold stored but not applied to binary C2PA |

**Placeholder scan:** No TBD/TODO/placeholder text in any task.

**Type consistency:** `MediaDetectionResult` and `MediaSettings` defined in Task 1 and used consistently in Tasks 2–7. `DisplayMode` imported from existing `types.ts`. `MEDIA_SCANNED_ATTR` exported from scanner and imported in content.ts Task 6.
