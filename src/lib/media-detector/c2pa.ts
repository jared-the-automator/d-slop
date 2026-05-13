import type { MediaDetectionResult } from './types';

const C2PA_UUID = new Uint8Array([
  0xCA, 0x7A, 0x7A, 0x7A, 0x00, 0x00, 0x11, 0x00,
  0x80, 0x00, 0x00, 0xAA, 0x00, 0x38, 0x9B, 0x71,
]);

const KNOWN_TOOLS = [
  'Adobe Firefly',
  'DALL-E',
  'Midjourney',
  'Stable Diffusion',
  'Bing Image Creator',
  'Microsoft Designer',
];

function findUuid(bytes: Uint8Array): number {
  const limit = bytes.length - C2PA_UUID.length;
  outer: for (let i = 0; i <= limit; i++) {
    for (let j = 0; j < C2PA_UUID.length; j++) {
      if (bytes[i + j] !== C2PA_UUID[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function extractToolName(bytes: Uint8Array, uuidIdx: number): string | undefined {
  const start = uuidIdx + C2PA_UUID.length;
  const end = Math.min(start + 512, bytes.length);
  const slice = bytes.slice(start, end);
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(slice);
    for (const tool of KNOWN_TOOLS) {
      if (text.includes(tool)) return tool;
    }
    const match = text.match(/"tool\.name"\s*:\s*"([^"]{1,80})"/);
    if (match) return match[1];
  } catch {
    // non-UTF-8 payload — no tool name recoverable
  }
  return undefined;
}

export function scanForC2PA(bytes: Uint8Array): MediaDetectionResult {
  const idx = findUuid(bytes);
  if (idx === -1) return { detected: false };
  return { detected: true, method: 'C2PA', tool: extractToolName(bytes, idx) };
}
