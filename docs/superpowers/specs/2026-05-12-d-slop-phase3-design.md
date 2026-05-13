# D-slop Phase 3: AI Media Detection — Design Spec

## Goal

Extend D-slop to detect AI-generated images, video, and audio using C2PA (Content Authenticity Initiative) provenance metadata, with per-channel user settings and a provider abstraction that supports a future D-slop+ paid tier backed by external APIs.

## Architecture

Phase 3 adds a media detection pipeline that runs alongside the existing text pipeline. The two pipelines share the same mode/threshold model and rendering approach but are otherwise independent — separate settings, separate scoring, separate DOM pass.

### New files

- `src/lib/media-detector/types.ts` — shared interfaces: `MediaDetectionResult`, `MediaDetector` (provider interface)
- `src/lib/media-detector/c2pa.ts` — C2PA provider implementation
- `src/lib/media-detector/scanner.ts` — DOM walker and provider orchestrator
- `src/lib/media-detector/renderer.ts` — applies highlight/collapse/hidden to flagged media elements

### Modified files

- `src/lib/storage.ts` — per-channel settings shape
- `src/entrypoints/content.ts` — add media scan pass alongside text scan
- `src/entrypoints/popup/App.tsx` — split UI into Text and Media sections

---

## Detection Pipeline

### C2PA library

Uses the `c2pa` npm package (Content Authenticity Initiative official JS SDK). The library requires a WASM worker file, which is placed in `public/` so WXT includes it in the extension build. The worker is referenced at runtime via `chrome.runtime.getURL('c2pa.worker.js')`.

### Detection flow

1. Scanner finds `<img>`, `<video>`, or `<audio>` elements with a `src` attribute.
2. Skips elements with `data:` URLs (no manifest possible).
3. Passes each URL to the active provider array.
4. The C2PA provider routes the fetch through the background service worker (avoids CORS issues with cross-origin media). Timeout: 5 seconds.
5. If a valid C2PA manifest is present and declares AI-generated provenance, returns `{ detected: true, method: 'C2PA', tool: string | undefined }`.
6. If no manifest or manifest declares human-captured origin, returns `{ detected: false }`.
7. Elements that 404 on refetch are marked unresolvable and not flagged.
8. Scanner returns flagged elements to the renderer.

### MutationObserver

The scanner runs once on `DOMContentLoaded` and again via a `MutationObserver` watching for new `<img>`, `<video>`, and `<audio>` elements, so lazily-loaded media is caught.

---

## Provider Abstraction

```ts
interface MediaDetectionResult {
  detected: boolean;
  method?: string;
  tool?: string;
}

interface MediaDetector {
  name: string;
  detect(url: string): Promise<MediaDetectionResult>;
}
```

The scanner accepts an array of providers and runs them in order, stopping at the first positive result. Free tier uses `[c2paProvider]`. D-slop+ uses `[c2paProvider, apiProvider]` — C2PA runs first; the API provider is called only if C2PA finds nothing.

Active provider array is determined by a `tier` value in storage (`'free' | 'plus'`), defaulting to `'free'`. The popup shows a static "Upgrade to D-slop+" placeholder link in the media section when on the free tier.

---

## Per-Channel Settings

### Storage shape

```ts
{
  text: { mode: 'highlight' | 'collapse' | 'hidden', threshold: number },
  media: { mode: 'highlight' | 'collapse' | 'hidden', threshold: number },
  tier: 'free' | 'plus'
}
```

On first load after upgrade, existing `mode` and `threshold` values migrate into `text`. Media defaults to `{ mode: 'highlight', threshold: 0.5 }`. Tier defaults to `'free'`.

The threshold field is reserved for D-slop+ API providers that return confidence scores. For C2PA (the free tier provider), detection is binary — a valid AI-provenance manifest is either present or absent. The C2PA provider always returns a score of `1.0` on positive detection, so any threshold value below `1.0` will flag it. The threshold slider is shown in the UI but has no practical effect on free tier behavior; it becomes meaningful when API providers are active.

### Popup UI

The popup splits into two labeled sections: **Text** and **Media**. Each section has the existing mode selector and threshold slider. The media section also shows a status line ("C2PA scanning active") and, on the free tier, an "Upgrade to D-slop+" link that is a placeholder for future monetization.

---

## Rendering

### Highlight

Orange outline added to the flagged element. A badge anchored to the top-right corner shows the detection method: "C2PA: AI-generated" or "C2PA: [tool name]" if the manifest names the generating tool. Badge uses the same visual style as existing text score badges.

### Collapse

The element is hidden and replaced with a same-size placeholder div containing the d-slop logo, "AI-generated media" label, and a "Show anyway" link. Clicking restores the original element. Placeholder preserves the original element's dimensions to prevent layout reflow.

### Hidden

Same full-page overlay as text mode. Triggered when any flagged media is detected on the page. Countdown + "Show anyway" button, identical behavior to text hidden mode.

---

## Out of Scope

- D-slop+ API provider implementation (future phase)
- Monetization / payment flow for D-slop+
- Local ML model-based detection
- Detection of AI-generated content in PDFs or other embedded documents
