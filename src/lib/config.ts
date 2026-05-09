export const RULES_URL =
  (import.meta.env.VITE_RULES_URL as string | undefined) ??
  'https://raw.githubusercontent.com/jared-the-automator/d-slop/main/rules/rules.json';

export const RULES_FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const RULES_CACHE_KEY = 'cachedRules';
export const RULES_LAST_FETCHED_KEY = 'rulesLastFetched';
export const ENABLED_KEY = 'enabled';
export const MODE_KEY = 'mode';
export const FLAG_COUNT_KEY = 'flagCount';
