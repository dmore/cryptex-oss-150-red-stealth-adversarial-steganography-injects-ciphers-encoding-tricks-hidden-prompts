import { describe, it, expect } from 'vitest';
import {
  dnaTupleOf,
  allCombinations,
  render,
  nullDNA,
  TEMP_BUCKETS,
} from '../dna';

describe('TEMP_BUCKETS', () => {
  it('maps 3 buckets to concrete temperatures', () => {
    expect(TEMP_BUCKETS.low).toBe(0.3);
    expect(TEMP_BUCKETS.med).toBe(0.7);
    expect(TEMP_BUCKETS.high).toBe(1.3);
  });
});

describe('nullDNA + render', () => {
  it('nullDNA renders as bare task with med temp', async () => {
    const r = await render(nullDNA(), 'hello');
    expect(r.userMessage).toBe('hello');
    expect(r.prefillMessages).toEqual([]);
    expect(r.temperature).toBe(TEMP_BUCKETS.med);
  });

  it('prefill DNA injects a user+assistant pair', async () => {
    const r = await render({ ...nullDNA(), prefillId: 'prefill_agreement' }, 'task');
    expect(r.prefillMessages).toHaveLength(2);
    expect(r.prefillMessages[0].role).toBe('user');
  });

  it('base64_smuggle wrapper produces base64 userMessage', async () => {
    const r = await render({ ...nullDNA(), wrapperId: 'base64_smuggle' }, 'hi');
    expect(r.userMessage).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(r.systemPrompt.toLowerCase()).toContain('base64');
  });
});

describe('allCombinations', () => {
  it('returns > 1000 combinations', () => {
    const all = allCombinations();
    expect(all.length).toBeGreaterThan(1000);
  });
  it('includes null-DNA as a valid control', () => {
    const all = allCombinations();
    expect(all.some(d =>
      d.mutatorId === null && d.classifierId === null && d.wrapperId === null &&
      d.modeId === null && d.prefillId === null)).toBe(true);
  });
});

describe('dnaTupleOf', () => {
  it('is deterministic and stable', () => {
    const a = { mutatorId: 'x', classifierId: null, wrapperId: null, modeId: null, prefillId: null, tempBucket: 'med' as const, source: 'builtin' as const };
    expect(dnaTupleOf(a)).toEqual(['x', '', '', '', '', 'med', 'builtin']);
    expect(dnaTupleOf(a)).toEqual(dnaTupleOf(a));
  });
});
