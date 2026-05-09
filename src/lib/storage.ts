import type { DisplayMode, ExtensionState, Rules } from './rules-engine/types';
import { DEFAULT_RULES } from './rules-engine/default-rules';
import {
  RULES_CACHE_KEY,
  ENABLED_KEY,
  MODE_KEY,
  FLAG_COUNT_KEY,
} from './config';

export async function getCachedRules(): Promise<Rules> {
  const result = await chrome.storage.local.get(RULES_CACHE_KEY);
  return (result[RULES_CACHE_KEY] as Rules | undefined) ?? DEFAULT_RULES;
}

export async function setCachedRules(rules: Rules): Promise<void> {
  await chrome.storage.local.set({ [RULES_CACHE_KEY]: rules });
}

export async function getExtensionState(): Promise<ExtensionState> {
  const result = await chrome.storage.local.get([ENABLED_KEY, MODE_KEY]);
  return {
    enabled: (result[ENABLED_KEY] as boolean | undefined) ?? true,
    mode: (result[MODE_KEY] as DisplayMode | undefined) ?? 'highlight',
  };
}

export async function setExtensionState(state: Partial<ExtensionState>): Promise<void> {
  await chrome.storage.local.set(state);
}

export async function getFlagCount(): Promise<number> {
  const result = await chrome.storage.local.get(FLAG_COUNT_KEY);
  return (result[FLAG_COUNT_KEY] as number | undefined) ?? 0;
}

export async function setFlagCount(count: number): Promise<void> {
  await chrome.storage.local.set({ [FLAG_COUNT_KEY]: count });
}
