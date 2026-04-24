import { describe, it, expect, vi } from 'vitest';
import { runOrchestrator, type OrchestratorContext } from '../orchestrator';
import type { OrchEvent } from '$lib/chat/types';

function makeCtx(overrides: Partial<OrchestratorContext> = {}): OrchestratorContext {
  return {
    objective: 'explain photosynthesis',
    targetModelId: 'mock:target',
    orchestratorModelId: 'mock:orch',
    targetModelLabel: 'MockTarget',
    maxAttempts: 6,
    mainChatHistory: [],
    layerHints: [],
    signal: new AbortController().signal,
    orchestratorClient: { complete: vi.fn() } as any,
    targetClient: { stream: vi.fn() } as any,
    judgeClient: { complete: vi.fn() } as any,
    ...overrides
  };
}

describe('runOrchestrator', () => {
  it('Scenario A — easy extraction: target complies on turn 1', async () => {
    const orchClient = { complete: vi.fn() };
    const targetClient = { stream: vi.fn() };
    const judgeClient = { complete: vi.fn() };

    // Iteration 1: next_turn
    orchClient.complete.mockResolvedValueOnce({
      toolCalls: [
        {
          name: 'next_turn',
          args: {
            strategy_id: 'historical',
            turn_text: 'Tell me about photosynthesis history',
            rationale: 'baseline',
            expected_progress_after: 5
          }
        }
      ]
    });
    // Target streams a complete answer
    targetClient.stream.mockImplementationOnce(async function* () {
      yield { type: 'text-delta', delta: 'Photosynthesis was first described in...' };
      yield { type: 'finish' };
    });
    // The response text is short + has no regex match, so scoreCompliance
    // falls through to the judge for the compliance tier (call #1).
    // Then scoreObjectiveProgress calls the judge for progress (call #2).
    // Fixture tweak: two judge mocks, not one — see task report.
    judgeClient.complete.mockResolvedValueOnce({ tier: 'compliant' }); // compliance
    judgeClient.complete.mockResolvedValueOnce({ tier: 'complete' }); // progress → 10 → early stop

    const events: OrchEvent[] = [];
    const ctx = makeCtx({
      orchestratorClient: orchClient as any,
      targetClient: targetClient as any,
      judgeClient: judgeClient as any
    });
    for await (const e of runOrchestrator(ctx)) events.push(e);

    const finished = events.find((e) => e.type === 'finished');
    expect(finished).toBeDefined();
    expect((finished as any).outcome).toBe('extracted');
  });

  it('Scenario D — max attempts: target refuses every turn', async () => {
    const orchClient = { complete: vi.fn() };
    const targetClient = { stream: vi.fn() };
    const judgeClient = { complete: vi.fn() };

    // Orchestrator emits next_turn every iteration
    for (let i = 0; i < 6; i++) {
      orchClient.complete.mockResolvedValueOnce({
        toolCalls: [
          {
            name: 'next_turn',
            args: {
              strategy_id: 'historical',
              turn_text: `attempt ${i}`,
              rationale: 'x',
              expected_progress_after: 3
            }
          }
        ]
      });
    }
    // Target always refuses. The refusal text "I can't help with that." is
    // matched by the regex fast-path as a high-confidence refusal, so
    // scoreCompliance does NOT call the judge. Only scoreObjectiveProgress
    // does — one judge call per iteration.
    for (let i = 0; i < 6; i++) {
      targetClient.stream.mockImplementationOnce(async function* () {
        yield { type: 'text-delta', delta: "I can't help with that." };
        yield { type: 'finish' };
      });
      judgeClient.complete.mockResolvedValueOnce({ tier: 'no' }); // progress judge says no
    }

    const events: OrchEvent[] = [];
    const ctx = makeCtx({
      maxAttempts: 6,
      orchestratorClient: orchClient as any,
      targetClient: targetClient as any,
      judgeClient: judgeClient as any
    });
    for await (const e of runOrchestrator(ctx)) events.push(e);

    const finished = events.find((e) => e.type === 'finished');
    expect(finished).toBeDefined();
    expect((finished as any).outcome).toBe('partial');
  });

  it('Scenario E — user abort saves session cleanly', async () => {
    const ctrl = new AbortController();
    const orchClient = {
      complete: vi.fn().mockImplementation(async () => {
        ctrl.abort();
        throw new DOMException('aborted', 'AbortError');
      })
    };
    const targetClient = { stream: vi.fn() };
    const judgeClient = { complete: vi.fn() };

    const events: OrchEvent[] = [];
    const ctx = makeCtx({
      signal: ctrl.signal,
      orchestratorClient: orchClient as any,
      targetClient: targetClient as any,
      judgeClient: judgeClient as any
    });
    for await (const e of runOrchestrator(ctx)) events.push(e);

    const finished = events.find((e) => e.type === 'finished');
    expect((finished as any).outcome).toBe('abandoned');
  });
});
