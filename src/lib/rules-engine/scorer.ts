import type { Rules, TextScore, SignalScore } from './types';
import {
  phraseMatchScore,
  sentenceUniformityScore,
  punctuationDensityScore,
  listUniformityScore,
  conclusionMarkerScore,
} from './signals';

const MIN_WORD_COUNT = 50;

export function score(text: string, rules: Rules): TextScore {
  const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < MIN_WORD_COUNT) {
    return { score: 0, signals: [], flagged: false };
  }

  const signals: SignalScore[] = [
    {
      name: 'phraseMatch',
      score: phraseMatchScore(text, rules.signals.phraseMatch.phrases),
      weight: rules.signals.phraseMatch.weight,
    },
    {
      name: 'burstiness',
      score: sentenceUniformityScore(text, rules.signals.burstiness.uniformityThreshold),
      weight: rules.signals.burstiness.weight,
    },
    {
      name: 'punctuationDensity',
      score: punctuationDensityScore(text, rules.signals.punctuationDensity.densityThreshold),
      weight: rules.signals.punctuationDensity.weight,
    },
    {
      name: 'listUniformity',
      score: listUniformityScore(text, rules.signals.listUniformity.varianceThreshold),
      weight: rules.signals.listUniformity.weight,
    },
    {
      name: 'conclusionMarkers',
      score: conclusionMarkerScore(text, rules.signals.conclusionMarkers.markers),
      weight: rules.signals.conclusionMarkers.weight,
    },
  ];

  const totalScore = signals.reduce((sum, s) => sum + s.score * s.weight, 0);

  return {
    score: totalScore,
    signals,
    flagged: totalScore >= rules.threshold,
  };
}
