export type DisplayMode = 'highlight' | 'collapse' | 'hidden';

export interface SignalConfig {
  weight: number;
}

export interface PhraseMatchConfig extends SignalConfig {
  phrases: string[];
}

export interface BurstinessConfig extends SignalConfig {
  uniformityThreshold: number;
}

export interface PunctuationConfig extends SignalConfig {
  densityThreshold: number;
}

export interface ListUniformityConfig extends SignalConfig {
  varianceThreshold: number;
}

export interface ConclusionConfig extends SignalConfig {
  markers: string[];
}

export interface Rules {
  version: number;
  threshold: number;
  signals: {
    phraseMatch: PhraseMatchConfig;
    burstiness: BurstinessConfig;
    punctuationDensity: PunctuationConfig;
    listUniformity: ListUniformityConfig;
    conclusionMarkers: ConclusionConfig;
  };
}

export interface SignalScore {
  name: string;
  score: number;
  weight: number;
}

export interface TextScore {
  score: number;
  signals: SignalScore[];
  flagged: boolean;
}

export interface ExtensionState {
  enabled: boolean;
  mode: DisplayMode;
}
