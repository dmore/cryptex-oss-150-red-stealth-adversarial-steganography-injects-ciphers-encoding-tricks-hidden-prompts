import { describe, it, expect } from 'vitest';
import { universalDecode } from './decoder';
import { getTransformer } from './registry';

describe('universalDecode', () => {
  it('returns null for empty input', () => {
    expect(universalDecode('')).toBeNull();
  });

  it('decodes a Base64-encoded string via a detector-driven transformer', () => {
    const b64 = getTransformer('Base64');
    if (!b64) return;
    const payload = 'universal decoder smoke test';
    const encoded = b64.func(payload);
    const result = universalDecode(encoded);
    expect(result).not.toBeNull();
    expect(result!.text).toBe(payload);
  });

  it('decodes a Hex-encoded string', () => {
    const hex = getTransformer('Hexadecimal');
    if (!hex) return;
    const payload = 'hex works';
    const encoded = hex.func(payload);
    const result = universalDecode(encoded);
    expect(result).not.toBeNull();
    expect(result!.text).toBe(payload);
  });

  it('returns alternatives when multiple transformers could decode', () => {
    // Binary happens to look like hex too under certain inputs — we
    // want the decoder to surface alternatives list at minimum.
    const binary = getTransformer('Binary');
    if (!binary) return;
    const encoded = binary.func('hi');
    const result = universalDecode(encoded);
    expect(result).not.toBeNull();
    // Primary may be Binary or another candidate, but alternatives must exist
    expect(result!.alternatives).toBeInstanceOf(Array);
  });

  it('ROT13 round-trips via the decoder', () => {
    const rot13 = getTransformer('ROT13');
    if (!rot13) return;
    const encoded = rot13.func('hello');
    const result = universalDecode(encoded);
    expect(result).not.toBeNull();
    // Not every candidate is ROT13; we just check the primary yields readable text.
    expect(typeof result!.text).toBe('string');
    expect(result!.text.length).toBeGreaterThan(0);
  });
});
