/**
 * SEAL stacked-cipher builder tests · v2.2 Wave 10.6
 *
 * Pin the cipher implementations (rot13, atbash, reverse, base64, hex)
 * + the layer-stacking order + the framing prompt shape. The published
 * SEAL paper depends on the model decoding outermost-first; we explicitly
 * assert that the framing instructs the model to do so.
 */

import { describe, test, expect } from 'vitest';
import {
  buildStackedCipherPayload,
  stackName,
  type CipherLayer
} from '$lib/redteam/stacked-cipher';

describe('buildStackedCipherPayload', () => {
  test('empty plaintext returns empty payload + notes', () => {
    const r = buildStackedCipherPayload('', ['rot13']);
    expect(r.encodedPayload).toBe('');
    expect(r.framedPrompt).toBe('');
    expect(r.notes).toMatch(/empty/i);
  });

  test('empty stack returns plaintext unchanged + notes', () => {
    const r = buildStackedCipherPayload('hello', []);
    expect(r.encodedPayload).toBe('hello');
    expect(r.framedPrompt).toBe('');
    expect(r.notes).toMatch(/no cipher layers/i);
  });

  test('single rot13 layer round-trips', () => {
    const r = buildStackedCipherPayload('hello', ['rot13']);
    expect(r.encodedPayload).toBe('uryyb');
  });

  test('single atbash layer round-trips', () => {
    const r = buildStackedCipherPayload('hello', ['atbash']);
    expect(r.encodedPayload).toBe('svool');
  });

  test('reverse layer reverses by code points', () => {
    const r = buildStackedCipherPayload('hello', ['reverse']);
    expect(r.encodedPayload).toBe('olleh');
  });

  test('base64 layer encodes UTF-8', () => {
    const r = buildStackedCipherPayload('hello', ['base64']);
    expect(r.encodedPayload).toBe('aGVsbG8=');
  });

  test('hex layer encodes as UTF-8 hex pairs', () => {
    const r = buildStackedCipherPayload('hi', ['hex']);
    expect(r.encodedPayload).toBe('6869');
  });

  test('two-layer stack applies innermost first', () => {
    // rot13('hi') = 'uv'; base64('uv') = 'dXY='
    const r = buildStackedCipherPayload('hi', ['rot13', 'base64']);
    expect(r.encodedPayload).toBe('dXY=');
  });

  test('framing tells the target to decode outermost-first', () => {
    const r = buildStackedCipherPayload('test goal', ['rot13', 'base64']);
    // The decode steps in the framing should list base64 (outermost) before
    // rot13 (innermost). Use a sequence-of-words assertion.
    const i64 = r.framedPrompt.indexOf('Base64');
    const i13 = r.framedPrompt.indexOf('ROT13');
    expect(i64).toBeGreaterThan(-1);
    expect(i13).toBeGreaterThan(-1);
    expect(i64).toBeLessThan(i13);
  });

  test('framing includes encoded payload and a layer count', () => {
    const r = buildStackedCipherPayload('test', ['rot13', 'base64']);
    expect(r.framedPrompt).toContain(r.encodedPayload);
    expect(r.framedPrompt).toMatch(/2 cipher layer/i);
  });

  test('paper citation surfaces in notes', () => {
    const r = buildStackedCipherPayload('test', ['rot13']);
    expect(r.notes).toMatch(/2505\.16241/);
  });
});

describe('stackName', () => {
  test('(none) for empty stack', () => {
    expect(stackName([])).toBe('(none)');
  });
  test('arrow-separated for non-empty', () => {
    const stack: CipherLayer[] = ['rot13', 'base64', 'hex'];
    expect(stackName(stack)).toBe('rot13 -> base64 -> hex');
  });
});
