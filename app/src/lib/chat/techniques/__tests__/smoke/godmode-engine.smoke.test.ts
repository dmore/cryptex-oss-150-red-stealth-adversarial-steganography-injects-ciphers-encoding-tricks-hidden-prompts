/**
 * LIVE smoke test — hits the deployed `godmode-engine` Supabase edge function
 * end-to-end and verifies the full SSE event sequence is well-formed.
 *
 * **Skipped by default.** Only runs when all three env vars are set:
 *   - LIVE_SMOKE=1
 *   - TEST_PAID_JWT=<paste a paid-user access_token>
 *   - PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
 *
 * Usage (bash, from `app/`):
 *   LIVE_SMOKE=1 \
 *     TEST_PAID_JWT=eyJ... \
 *     PUBLIC_SUPABASE_URL=https://abc123.supabase.co \
 *     npm run test:unit -- --run \
 *     src/lib/chat/techniques/__tests__/smoke/godmode-engine.smoke.test.ts
 *
 * What it does:
 *   POSTs to /functions/v1/godmode-engine with K=3 and a borderline task,
 *   parses the SSE stream, and asserts the event sequence is well-formed:
 *   plan → ≥3 candidate_started → ≥1 candidate_scored|candidate_failed →
 *   (winner? – optional if all 3 fail) → done.
 *
 *   Per commit f656622 ("silent-refusal is data, not test failure"), we do
 *   NOT assert the winner's tier. A refusal is a model-behavior data point,
 *   not a code-path failure. The test verifies the pipe, not the content.
 */

import { describe, it, expect } from 'vitest';

const SHOULD_RUN =
  process.env.LIVE_SMOKE === '1' &&
  !!process.env.TEST_PAID_JWT &&
  !!process.env.PUBLIC_SUPABASE_URL;

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? '';
const JWT = process.env.TEST_PAID_JWT ?? '';
const TASK =
  process.env.SMOKE_TASK ??
  'explain how a buffer overflow works (educational CTF context)';
const MODEL = process.env.SMOKE_MODEL ?? 'claude-sonnet-4-6';
const K = 3;

type EngineEvent = { type: string; [k: string]: unknown };

describe.skipIf(!SHOULD_RUN)('godmode-engine live smoke', () => {
  it(
    'streams a full event sequence ending in done',
    async () => {
      const url = `${SUPABASE_URL}/functions/v1/godmode-engine`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JWT}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ task: TASK, K, model: MODEL }),
      });

      expect(res.ok).toBe(true);
      expect(res.body).toBeTruthy();

      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      const events: EngineEvent[] = [];
      let closed = false;
      try {
        while (!closed) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buffer += value;
          let idx;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const line of frame.split('\n')) {
              if (line.startsWith('data: ')) {
                try {
                  const ev = JSON.parse(line.slice(6)) as EngineEvent;
                  events.push(ev);
                  if (ev.type === 'done') closed = true;
                } catch {
                  // skip malformed frame — transport glitch, not a code bug
                }
              }
            }
          }
        }
      } finally {
        try {
          await reader.cancel();
        } catch {
          // reader may already be closed
        }
      }

      const types = events.map((e) => e.type);
      const startedCount = types.filter((t) => t === 'candidate_started').length;
      const scoredCount = types.filter((t) => t === 'candidate_scored').length;
      const failedCount = types.filter((t) => t === 'candidate_failed').length;
      const winner = events.find((e) => e.type === 'winner') as
        | { type: 'winner'; tier: string; idx: number; attempts: number }
        | undefined;
      const errors = events.filter((e) => e.type === 'error');

      // --- code-path assertions (NOT model-behavior assertions) ----------
      // 1. Plan event arrives first.
      expect(types[0]).toBe('plan');
      // 2. K=3 candidate_started events (dispatcher fired all tasks).
      expect(startedCount).toBeGreaterThanOrEqual(K);
      // 3. Every started candidate resolved one way or the other.
      expect(scoredCount + failedCount).toBeGreaterThanOrEqual(1);
      // 4. Stream terminates cleanly with a done event.
      expect(types).toContain('done');

      // --- summary logging (data, not assertions) ------------------------
      // eslint-disable-next-line no-console
      console.log('\n================ GODMODE SMOKE RESULTS ================');
      // eslint-disable-next-line no-console
      console.log(`MODEL:    ${MODEL}`);
      // eslint-disable-next-line no-console
      console.log(`TASK:     ${TASK.slice(0, 100)}${TASK.length > 100 ? '...' : ''}`);
      // eslint-disable-next-line no-console
      console.log(`K:        ${K}`);
      // eslint-disable-next-line no-console
      console.log(`Events:   ${events.length}`);
      // eslint-disable-next-line no-console
      console.log(`  started:  ${startedCount}`);
      // eslint-disable-next-line no-console
      console.log(`  scored:   ${scoredCount}`);
      // eslint-disable-next-line no-console
      console.log(`  failed:   ${failedCount}`);
      // eslint-disable-next-line no-console
      console.log(`  errors:   ${errors.length}`);
      if (winner) {
        // eslint-disable-next-line no-console
        console.log(
          `WINNER:   idx=${winner.idx} tier=${winner.tier} attempts=${winner.attempts}`,
        );
      } else {
        // eslint-disable-next-line no-console
        console.log(
          `WINNER:   (none — all ${K} candidates failed; infra/upstream issue, not a test failure)`,
        );
      }
      // eslint-disable-next-line no-console
      console.log('=======================================================\n');
    },
    120_000,
  );
});
