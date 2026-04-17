/**
 * Parity tests for the ported Gibberish tool. Validates determinism against
 * the legacy implementation for fixed seeds — anything non-deterministic
 * (empty-seed path for sentenceToGibberish, random seed for removals)
 * is tested for structural invariants instead.
 */
import { describe, expect, it } from 'vitest';
import {
  seededRandomSin,
  seededRandomFactory,
  sentenceToGibberish,
  generateRandomRemovals,
  removeSpecificChars
} from './gibberish';

describe('seededRandomSin', () => {
  it('is deterministic for the same seed', () => {
    expect(seededRandomSin(42)).toBe(seededRandomSin(42));
  });
  it('produces values in [0,1)', () => {
    for (let s = 0; s < 50; s++) {
      const v = seededRandomSin(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('seededRandomFactory', () => {
  it('returns Math.random for empty seed', () => {
    expect(seededRandomFactory('')).toBe(Math.random);
  });
  it('produces deterministic stream for a given seed', () => {
    const a = seededRandomFactory('hello');
    const b = seededRandomFactory('hello');
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
  it('different seeds produce different streams', () => {
    const a = seededRandomFactory('alpha');
    const b = seededRandomFactory('beta');
    // Exceedingly unlikely to match within 10 draws
    let diverged = false;
    for (let i = 0; i < 10 && !diverged; i++) if (a() !== b()) diverged = true;
    expect(diverged).toBe(true);
  });
});

describe('sentenceToGibberish (seeded)', () => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

  it('produces identical output for identical seed', () => {
    const a = sentenceToGibberish('Hello world hello', '7', chars);
    const b = sentenceToGibberish('Hello world hello', '7', chars);
    expect(a.output).toBe(b.output);
    expect(a.dictionary).toBe(b.dictionary);
  });

  it('maps the same word to the same gibberish (case-insensitive)', () => {
    const r = sentenceToGibberish('cat Cat CAT', '3', chars);
    // Each occurrence of 'cat' should map to the same replacement
    const parts = r.output.split(' ');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe(parts[1]);
    expect(parts[1]).toBe(parts[2]);
  });

  it('preserves non-word characters', () => {
    const r = sentenceToGibberish('hi, world!', '5', chars);
    expect(r.output).toMatch(/^\w+, \w+!$/);
  });

  it('returns empty for empty input', () => {
    expect(sentenceToGibberish('', '1', chars)).toEqual({ output: '', dictionary: '' });
  });
});

describe('generateRandomRemovals', () => {
  it('respects variation count', () => {
    const out = generateRandomRemovals('the quick brown fox', {
      variations: 7,
      minLetters: 1,
      maxLetters: 2,
      seed: 'fixed'
    });
    expect(out.length).toBe(7);
  });

  it('is deterministic with a seed', () => {
    const opts = { variations: 5, minLetters: 1, maxLetters: 2, seed: 'deterministic' };
    const a = generateRandomRemovals('the quick brown fox jumped', opts);
    const b = generateRandomRemovals('the quick brown fox jumped', opts);
    expect(a).toEqual(b);
  });

  it('never strips non-alpha or 1-char words', () => {
    const out = generateRandomRemovals('a 12 hello', {
      variations: 3,
      minLetters: 2,
      maxLetters: 2,
      seed: 'x'
    });
    for (const line of out) {
      const tokens = line.split(' ');
      expect(tokens[0]).toBe('a');
      expect(tokens[1]).toBe('12');
    }
  });
});

describe('removeSpecificChars', () => {
  it('removes all specified characters', () => {
    expect(removeSpecificChars('Hello World', 'lo')).toBe('He Wrd');
  });
  it('is a no-op when empty remove set', () => {
    expect(removeSpecificChars('abc', '')).toBe('abc');
  });
});
