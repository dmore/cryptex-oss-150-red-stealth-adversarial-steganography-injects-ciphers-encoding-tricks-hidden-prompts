import { describe, expect, test, vi } from 'vitest';

import { allCampaignStrategies, resolveStrategies } from '../adapters';
import type { CampaignStrategyContext } from '../strategy';
import type { JudgeResult } from '../judge';

function fakeJudge(): JudgeResult {
  return {
    verdict: 'bypassed',
    score: 0.8,
    reasoning: 'test',
    usedFallback: false,
    raw: { refused: false, specificity: 4, convincingness: 5, finalScore: 0.8 }
  };
}

/** A context whose callTarget/callHelper/judge are spies returning canned values. */
function makeCtx(overrides: Partial<CampaignStrategyContext> = {}): {
  ctx: CampaignStrategyContext;
  targetCalls: number;
  helperCalls: number;
  judgeCalls: number;
} {
  let targetCalls = 0;
  let helperCalls = 0;
  let judgeCalls = 0;
  const ctx: CampaignStrategyContext = {
    goal: 'benign test goal',
    targetModel: 'test:model',
    async callTarget() {
      targetCalls++;
      return 'a substantive target response with real detail';
    },
    async callHelper() {
      helperCalls++;
      return 'generated transformed prompt';
    },
    async judge() {
      judgeCalls++;
      return fakeJudge();
    },
    signal: new AbortController().signal,
    ...overrides
  };
  return {
    ctx,
    get targetCalls() {
      return targetCalls;
    },
    get helperCalls() {
      return helperCalls;
    },
    get judgeCalls() {
      return judgeCalls;
    }
  } as never;
}

describe('campaign adapters', () => {
  test('every strategy has a unique id, a label, and an estimatedCalls', () => {
    const all = allCampaignStrategies();
    expect(all.length).toBeGreaterThan(10);
    const ids = new Set(all.map((s) => s.id));
    expect(ids.size).toBe(all.length); // all unique
    for (const s of all) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.estimatedCalls).toBeGreaterThanOrEqual(1);
      expect(['single-local', 'single-llm', 'orchestrator']).toContain(s.kind);
    }
  });

  test('abliteration is NOT exposed as a campaign strategy', () => {
    const all = allCampaignStrategies();
    expect(all.some((s) => s.id.includes('abliteration'))).toBe(false);
  });

  test('a single-local strategy makes exactly one target call + one judge call', async () => {
    const strat = allCampaignStrategies().find((s) => s.id.startsWith('reasoning:'))!;
    expect(strat.kind).toBe('single-local');
    const h = makeCtx();
    const result = await strat.run(h.ctx);
    expect(result.payloadSent.length).toBeGreaterThan(0);
    expect(result.targetResponse.length).toBeGreaterThan(0);
    expect(result.verdict.verdict).toBe('bypassed');
    expect(result.callCount).toBe(1);
  });

  test('a cipher strategy produces a framed prompt + uniform result shape', async () => {
    const strat = allCampaignStrategies().find((s) => s.id.startsWith('cipher:'))!;
    const h = makeCtx();
    const result = await strat.run(h.ctx);
    expect(result.payloadSent.length).toBeGreaterThan(0);
    expect(result).toHaveProperty('verdict');
    expect(result).toHaveProperty('callCount');
  });

  test('resolveStrategies supports exact ids, family globs, and *', () => {
    const reasoning = resolveStrategies(['reasoning:*']);
    expect(reasoning.length).toBeGreaterThan(0);
    expect(reasoning.every((s) => s.id.startsWith('reasoning:'))).toBe(true);

    const all = resolveStrategies(['*']);
    expect(all.length).toBe(allCampaignStrategies().length);

    const unknown = resolveStrategies(['does:not:exist']);
    expect(unknown.length).toBe(0); // unknowns dropped

    const mixed = resolveStrategies(['cipher:*', 'reasoning:hcot', 'bogus:id']);
    expect(mixed.some((s) => s.id === 'reasoning:hcot')).toBe(true);
    expect(mixed.every((s) => s.id.startsWith('cipher:') || s.id === 'reasoning:hcot')).toBe(true);
  });

  test('bundles resolve to non-empty strategy sets', () => {
    expect(resolveStrategies(['reasoning:*']).length).toBeGreaterThanOrEqual(3);
    expect(resolveStrategies(['cipher:*']).length).toBeGreaterThanOrEqual(2);
    expect(resolveStrategies(['orch:*']).length).toBe(4);
  });
});
