import { describe, it, expect } from 'vitest';
import { scanForC2PA } from '../../src/lib/media-detector/c2pa';

const C2PA_UUID = new Uint8Array([
  0xCA, 0x7A, 0x7A, 0x7A, 0x00, 0x00, 0x11, 0x00,
  0x80, 0x00, 0x00, 0xAA, 0x00, 0x38, 0x9B, 0x71,
]);

function makeBytesWithUuid(toolName?: string): Uint8Array {
  const prefix = new Uint8Array(32).fill(0x00);
  const suffix = new Uint8Array(32).fill(0xFF);
  const toolBytes = toolName
    ? new TextEncoder().encode(JSON.stringify({ 'tool.name': toolName }))
    : new Uint8Array(0);
  const out = new Uint8Array(
    prefix.length + C2PA_UUID.length + toolBytes.length + suffix.length
  );
  out.set(prefix, 0);
  out.set(C2PA_UUID, prefix.length);
  out.set(toolBytes, prefix.length + C2PA_UUID.length);
  out.set(suffix, prefix.length + C2PA_UUID.length + toolBytes.length);
  return out;
}

describe('scanForC2PA', () => {
  it('returns detected:false for empty bytes', () => {
    expect(scanForC2PA(new Uint8Array(0))).toEqual({ detected: false });
  });

  it('returns detected:false when UUID absent', () => {
    expect(scanForC2PA(new Uint8Array(64).fill(0x00))).toEqual({
      detected: false,
    });
  });

  it('returns detected:true when UUID present without tool name', () => {
    const result = scanForC2PA(makeBytesWithUuid());
    expect(result.detected).toBe(true);
    expect(result.method).toBe('C2PA');
    expect(result.tool).toBeUndefined();
  });

  it('returns detected:true with tool name when present', () => {
    const result = scanForC2PA(makeBytesWithUuid('Adobe Firefly'));
    expect(result.detected).toBe(true);
    expect(result.method).toBe('C2PA');
    expect(result.tool).toBe('Adobe Firefly');
  });

  it('extracts known tool names', () => {
    const knownTools = [
      'Adobe Firefly',
      'DALL-E',
      'Midjourney',
      'Stable Diffusion',
      'Bing Image Creator',
      'Microsoft Designer',
    ];
    for (const tool of knownTools) {
      const result = scanForC2PA(makeBytesWithUuid(tool));
      expect(result.tool).toBe(tool);
    }
  });
});
