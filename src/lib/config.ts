export const RULES_URL =
  (import.meta.env.VITE_RULES_URL as string | undefined) ??
  'https://d-slop-rules.jared-the-automator.workers.dev';

export const RULES_FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const RULES_CACHE_KEY = 'cachedRules';
export const RULES_LAST_FETCHED_KEY = 'rulesLastFetched';
export const ENABLED_KEY = 'enabled';
export const MODE_KEY = 'mode';
export const FLAG_COUNT_KEY = 'flagCount';
export const USER_THRESHOLD_KEY = 'userThreshold';
export const DEFAULT_THRESHOLD = 0.20;
