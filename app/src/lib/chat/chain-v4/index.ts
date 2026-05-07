/**
 * chain-v4 entry point.
 *
 * Public surface: `runAttackSessionV4(ctx)` — async generator yielding
 * OrchEvent. Mirrors v3's `runAttackSession` signature so the caller in
 * AttackChainTab.svelte (post phase 7) only branches on
 * `attackChainConfig.engineVersion`.
 *
 * Phase 1 status: STUB. We delegate to v3's runAttackSession so the v4
 * code path is exercisable end-to-end while the actual modes (PAIR/TAP/
 * Crescendo) are implemented in phases 2–5. The stub yields one
 * `stream_started` + a delegated v3 run + one `stream_finished`, so
 * existing UI handlers light up the new stream-event surface immediately.
 *
 * Backward compat: when called with `mode === 'pair'` (default), this
 * stub is functionally identical to v3 — no behaviour change for users
 * who flip `engineVersion='v4'` early. Real PAIR semantics replace the
 * stub in phase 3.
 */
import type { OrchEvent } from '$lib/chat/types';
import {
  runAttackSession,
  type AttackSessionContext
} from '../chain/orchestrator';
import type { ChainV4Context } from './types';

export type { ChainV4Context };
export {
  DEFAULT_V4_BUDGET,
  DEFAULT_V4_MODE,
  DEFAULT_V4_STREAM_COUNT,
  DEFAULT_V4_BEST_OF_N
} from './types';

/**
 * Build a v3 AttackSessionContext from a v4 ChainV4Context. The mapping
 * is direct for the shared fields; v4-specific knobs are silently
 * ignored by the v3 stub. Phase 3+ replaces this with the real PAIR
 * engine and stops calling v3 entirely for v4 runs.
 */
function v4CtxToV3(ctx: ChainV4Context): AttackSessionContext {
  return {
    objective: ctx.objective,
    targetModelId: ctx.targetModelId,
    orchestratorModelId: ctx.orchestratorModelId,
    judgeModelId: ctx.judgeModelId,
    targetModelLabel: ctx.targetModelLabel,
    // v3 used `maxAttempts` for the total turn budget. Map it from v4's
    // maxQueries cap so users who flip to v4 don't accidentally see
    // unbounded runs while modes are stubbed.
    maxAttempts: ctx.budget.maxQueries,
    mainChatHistory: ctx.mainChatHistory,
    signal: ctx.signal,
    gatewayChat: ctx.gatewayChat,
    streamChat: ctx.streamChat
  };
}

/**
 * Phase 1 stub. Yields stream_started, delegates to v3, yields
 * stream_finished. Phase 3+ replaces internals with real PAIR/TAP/
 * Crescendo loops keyed off `ctx.mode`.
 */
export async function* runAttackSessionV4(
  ctx: ChainV4Context
): AsyncGenerator<OrchEvent> {
  const streamId = 0;
  yield { type: 'stream_started', streamId };

  let outcome: 'extracted' | 'partial' | 'abandoned' = 'abandoned';
  try {
    for await (const ev of runAttackSession(v4CtxToV3(ctx))) {
      yield ev;
      if (ev.type === 'finished') {
        outcome = ev.outcome;
      }
    }
  } finally {
    yield { type: 'stream_finished', streamId, outcome };
  }
}
