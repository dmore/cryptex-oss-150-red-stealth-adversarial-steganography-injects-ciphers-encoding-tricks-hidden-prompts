import { afterEach, describe, expect, test, vi } from 'vitest';

// Mock the gateway so callTarget / callHelper / judge never hit the network.
vi.mock('$lib/ai/gateway', () => ({
  chat: vi.fn().mockResolvedValue({
    content: '{"refused": false, "specificity": 4, "convincingness": 4}'
  })
}));

// Spy on history.record.
const recordMock = vi.fn().mockResolvedValue({});
vi.mock('$lib/history/store.svelte', () => ({
  history: { record: (...a: unknown[]) => recordMock(...a) }
}));

import { estimateCalls, startCampaign, CAMPAIGN_TOOL_ID } from '../runner';
import { activeRuns } from '$lib/stores/activeRuns.svelte';
import type { CampaignStrategy } from '../strategy';

afterEach(() => {
  recordMock.mockClear();
  activeRuns.clear(CAMPAIGN_TOOL_ID);
});

function stubStrategy(id: string, track: { live: number; peak: number }): CampaignStrategy {
  return {
    id,
    label: id,
    kind: 'single-local',
    estimatedCalls: 1,
    async run(ctx) {
      track.live++;
      track.peak = Math.max(track.peak, track.live);
      try {
        const resp = await ctx.callTarget([{ role: 'user', content: 'x' }]);
        const verdict = await ctx.judge(ctx.goal, resp);
        return { payloadSent: 'x', targetResponse: resp, verdict, callCount: 1 };
      } finally {
        track.live--;
      }
    }
  };
}

async function waitForDone(timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  for (;;) {
    const run = activeRuns.get(CAMPAIGN_TOOL_ID);
    if (run && run.status !== 'running') return;
    if (Date.now() - start > timeoutMs) throw new Error('campaign did not finish in time');
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('estimateCalls', () => {
  test('sums estimatedCalls + 1 judge per strategy', () => {
    const s = (n: number): CampaignStrategy => ({ id: `s${n}`, label: '', kind: 'single-local', estimatedCalls: n, run: async () => ({ payloadSent: '', targetResponse: '', verdict: {} as never, callCount: 0 }) });
    expect(estimateCalls([s(1), s(20), s(12)])).toBe(1 + 1 + 20 + 1 + 12 + 1); // 36
  });
});

describe('startCampaign', () => {
  test('runs all strategies, respects concurrency cap, records history once', async () => {
    const track = { live: 0, peak: 0 };
    const strategies = ['a', 'b', 'c', 'd', 'e'].map((id) => stubStrategy(id, track));
    startCampaign({
      goal: 'benign goal',
      targetModel: 'test:target',
      judgeModel: 'test:judge',
      strategies,
      concurrency: 2
    });
    await waitForDone();

    const data = activeRuns.get(CAMPAIGN_TOOL_ID)?.data as { rows: { status: string }[]; doneCount: number; total: number; totalCalls: number } | undefined;
    expect(data).toBeTruthy();
    expect(data!.total).toBe(5);
    expect(data!.doneCount).toBe(5);
    expect(data!.rows.every((r) => r.status === 'done')).toBe(true);
    expect(track.peak).toBeLessThanOrEqual(2); // concurrency cap honored
    expect(track.peak).toBeGreaterThan(0);
    expect(data!.totalCalls).toBe(10); // 5 strategies × (1 target + 1 judge)
    expect(recordMock).toHaveBeenCalledTimes(1);
  });

  test('a throwing strategy is isolated — others still complete', async () => {
    const track = { live: 0, peak: 0 };
    const good = ['a', 'b'].map((id) => stubStrategy(id, track));
    const bad: CampaignStrategy = {
      id: 'boom',
      label: 'boom',
      kind: 'single-local',
      estimatedCalls: 1,
      async run() {
        throw new Error('kaboom');
      }
    };
    startCampaign({ goal: 'g', targetModel: 't', judgeModel: 'j', strategies: [good[0], bad, good[1]], concurrency: 3 });
    await waitForDone();

    const data = activeRuns.get(CAMPAIGN_TOOL_ID)?.data as { rows: { strategyId: string; status: string; error?: string }[] } | undefined;
    const boom = data!.rows.find((r) => r.strategyId === 'boom');
    expect(boom!.status).toBe('error');
    expect(boom!.error).toContain('kaboom');
    expect(data!.rows.filter((r) => r.status === 'done').length).toBe(2);
  });
});
