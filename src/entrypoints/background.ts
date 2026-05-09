import { RULES_URL, RULES_FETCH_INTERVAL_MS, RULES_LAST_FETCHED_KEY } from '../lib/config';
import { setCachedRules } from '../lib/storage';
import type { Rules } from '../lib/rules-engine/types';

async function fetchAndCacheRules(): Promise<void> {
  try {
    const res = await fetch(RULES_URL);
    if (!res.ok) return;
    const rules: Rules = await res.json();
    if (!rules || typeof rules.version !== 'number' || !rules.signals || typeof rules.threshold !== 'number') return;
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
});
