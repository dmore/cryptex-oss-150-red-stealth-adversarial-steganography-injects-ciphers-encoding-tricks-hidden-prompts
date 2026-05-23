import { describe, it, expect } from 'vitest';
import {
  HEATMAP,
  ATTACK_PATTERNS,
  PROVIDERS,
  ATTACK_PATTERN_LABELS,
  ATTACK_PATTERN_DESCRIPTIONS,
  PROVIDER_LABELS,
  heatBand,
  type Provider,
  type AttackPattern
} from '../tool-result-heatmap';

describe('tool-result-heatmap', () => {
  it('HEATMAP exposes 3 providers', () => {
    const providers = Object.keys(HEATMAP) as Provider[];
    expect(providers.length).toBe(3);
    expect(providers).toEqual(expect.arrayContaining(['openai', 'anthropic', 'generic']));
  });

  it('every provider has all 5 attack patterns', () => {
    for (const p of PROVIDERS) {
      const patterns = Object.keys(HEATMAP[p]) as AttackPattern[];
      expect(patterns.length).toBe(5);
      for (const ap of ATTACK_PATTERNS) {
        expect(HEATMAP[p]).toHaveProperty(ap);
      }
    }
  });

  it('every value is between 0 and 1 (inclusive)', () => {
    for (const p of PROVIDERS) {
      for (const ap of ATTACK_PATTERNS) {
        const v = HEATMAP[p][ap];
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('ATTACK_PATTERN_LABELS covers every pattern', () => {
    for (const ap of ATTACK_PATTERNS) {
      expect(ATTACK_PATTERN_LABELS[ap]).toBeTypeOf('string');
      expect(ATTACK_PATTERN_LABELS[ap].length).toBeGreaterThan(0);
    }
  });

  it('ATTACK_PATTERN_DESCRIPTIONS covers every pattern', () => {
    for (const ap of ATTACK_PATTERNS) {
      expect(ATTACK_PATTERN_DESCRIPTIONS[ap]).toBeTypeOf('string');
      expect(ATTACK_PATTERN_DESCRIPTIONS[ap].length).toBeGreaterThan(10);
    }
  });

  it('PROVIDER_LABELS covers every provider', () => {
    for (const p of PROVIDERS) {
      expect(PROVIDER_LABELS[p]).toBeTypeOf('string');
      expect(PROVIDER_LABELS[p].length).toBeGreaterThan(0);
    }
  });

  it('heatBand classifies scores into hot/warm/cool buckets', () => {
    expect(heatBand(0.9)).toBe('hot');
    expect(heatBand(0.6)).toBe('hot');
    expect(heatBand(0.5)).toBe('warm');
    expect(heatBand(0.4)).toBe('warm');
    expect(heatBand(0.3)).toBe('cool');
    expect(heatBand(0)).toBe('cool');
  });

  it('generic provider scores are higher on average than anthropic (custom frameworks weaker)', () => {
    const avg = (p: Provider) =>
      ATTACK_PATTERNS.reduce((sum, ap) => sum + HEATMAP[p][ap], 0) / ATTACK_PATTERNS.length;
    expect(avg('generic')).toBeGreaterThan(avg('anthropic'));
  });
});
