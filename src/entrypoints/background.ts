import { RULES_URL, RULES_FETCH_INTERVAL_MS, RULES_LAST_FETCHED_KEY } from '../lib/config';
import { setCachedRules } from '../lib/storage';
import type { Rules } from '../lib/rules-engine/types';
import { scanForC2PA } from '../lib/media-detector/c2pa';
import type { MediaDetectionResult } from '../lib/media-detector/types';

async function fetchAndCacheRules(): Promise<void> {
  try {
    const res = await fetch(RULES_URL);
    if (!res.ok) return;
    const rules: Rules = await res.json();
    if (!rules || typeof rules.version !== 'number' || !rules.signals || typeof rules.threshold !== 'number') return;
    const s = rules.signals;
    if (
      !Array.isArray(s.phraseMatch?.phrases) ||
      typeof s.burstiness?.uniformityThreshold !== 'number' ||
      typeof s.punctuationDensity?.densityThreshold !== 'number' ||
      typeof s.listUniformity?.varianceThreshold !== 'number' ||
      !Array.isArray(s.conclusionMarkers?.markers)
    ) return;
    await setCachedRules(rules);
    await chrome.storage.local.set({ [RULES_LAST_FETCHED_KEY]: Date.now() });
  } catch {
    // Keep existing cached rules on network failure
  }
}

async function maybeRefreshRules(): Promise<void> {
  const result = await chrome.storage.local.get(RULES_LAST_FETCHED_KEY);
  const lastFetched = result[RULES_LAST_FETCHED_KEY] as number | undefined;
  if (!lastFetched || Date.now() - lastFetched > RULES_FETCH_INTERVAL_MS) {
    await fetchAndCacheRules();
  }
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => fetchAndCacheRules());
  chrome.runtime.onStartup.addListener(() => maybeRefreshRules());

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
});
