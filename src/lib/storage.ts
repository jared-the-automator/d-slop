import type { DisplayMode, ExtensionState, Rules } from './rules-engine/types';
import type { MediaSettings } from './media-detector/types';
import { DEFAULT_RULES } from './rules-engine/default-rules';
import {
  RULES_CACHE_KEY,
  ENABLED_KEY,
  MODE_KEY,
  FLAG_COUNT_KEY,
  USER_THRESHOLD_KEY,
  DEFAULT_THRESHOLD,
  MEDIA_MODE_KEY,
  MEDIA_THRESHOLD_KEY,
  TIER_KEY,
  DEFAULT_MEDIA_THRESHOLD,
  DEFAULT_MEDIA_MODE,
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

export async function getUserThreshold(): Promise<number> {
  const result = await chrome.storage.local.get(USER_THRESHOLD_KEY);
  return (result[USER_THRESHOLD_KEY] as number | undefined) ?? DEFAULT_THRESHOLD;
}

export async function setUserThreshold(value: number): Promise<void> {
  await chrome.storage.local.set({ [USER_THRESHOLD_KEY]: value });
}

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

export async function setTier(tier: 'free' | 'plus'): Promise<void> {
  await chrome.storage.local.set({ [TIER_KEY]: tier });
}
