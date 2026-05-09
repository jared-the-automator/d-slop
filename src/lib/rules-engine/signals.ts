function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function phraseMatchScore(text: string, phrases: readonly string[]): number {
  if (phrases.length === 0) return 0;
  const lower = text.toLowerCase();
  const matches = phrases.filter(p => lower.includes(p.toLowerCase())).length;
  return Math.min(1, matches / 3);
}

export function conclusionMarkerScore(text: string, markers: readonly string[]): number {
  const lower = text.toLowerCase();
  return markers.some(m => lower.includes(m.toLowerCase())) ? 1 : 0;
}

export function sentenceUniformityScore(text: string, uniformityThreshold: number): number {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim().split(/\s+/).filter(w => w.length > 0).length)
    .filter(len => len > 0);
  if (sentences.length < 3) return 0;
  const mean = sentences.reduce((a, b) => a + b, 0) / sentences.length;
  if (mean === 0) return 0;
  const cv = stdDev(sentences) / mean;
  return Math.max(0, 1 - cv / uniformityThreshold);
}

export function punctuationDensityScore(text: string, densityThreshold: number): number {
  const emDashes = (text.match(/—/g) ?? []).length;
  const semicolons = (text.match(/;/g) ?? []).length;
  const words = text.trim().split(/\s+/).length;
  if (words === 0) return 0;
  const density = (emDashes + semicolons) / words;
  return Math.min(1, density / densityThreshold);
}

export function listUniformityScore(text: string, varianceThreshold: number): number {
  const lines = text.split('\n');
  const items = lines
    .filter(l => /^\s*[-•*]|^\s*\d+[.)]\s/.test(l))
    .map(l => l.replace(/^\s*[-•*\d.)\s]+/, '').trim())
    .filter(l => l.length > 0);
  if (items.length < 3) return 0;
  const lengths = items.map(i => i.split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean === 0) return 0;
  const cv = stdDev(lengths) / mean;
  return Math.max(0, 1 - cv / varianceThreshold);
}
