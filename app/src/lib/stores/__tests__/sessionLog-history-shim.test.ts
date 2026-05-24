/**
 * Wave 4.2 — sessionLog → history v2 compat shim.
 *
 * Verifies that legacy `sessionLog.record()` and `sessionLog.recordError()`
 * calls also fan-out to the persistent history v2 store without breaking
 * the in-memory ring buffer the 13 existing callers depend on.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { sessionLog } from '../sessionLog.svelte';
import { history, _resetForTests } from '$lib/history/store.svelte';

beforeEach(() => {
  _resetForTests();
  sessionLog.clear();
  localStorage.clear();
});

describe('sessionLog → history v2 compat shim', () => {
  it('record() appends to both the in-memory ring AND history v2', async () => {
    sessionLog.record({
      tool: 'transform',
      operation: 'encode',
      label: 'caesar',
      input: 'hello',
      output: 'khoor',
      options: { shift: 3 }
    });

    // Legacy in-memory ring still works
    expect(sessionLog.size).toBe(1);
    expect(sessionLog.entries[0].tool).toBe('transform');
    expect(sessionLog.entries[0].operation).toBe('encode');
    expect(sessionLog.entries[0].label).toBe('caesar');
    expect(sessionLog.entries[0].input).toBe('hello');
    expect(sessionLog.entries[0].output).toBe('khoor');

    // history.record is fire-and-forget but resolves on next microtask
    await Promise.resolve();
    await Promise.resolve();

    expect(history.all.length).toBe(1);
    const run = history.all[0];
    expect(run.toolId).toBe('transform');
    expect(run.status).toBe('done');
    expect(run.inputSummary).toBe('hello');
    expect(run.outputSummary).toBe('khoor');
    expect(run.params.operation).toBe('encode');
    expect(run.params.label).toBe('caesar');
    expect(run.params.shift).toBe(3);
  });

  it('record() collapses startedAt and finishedAt to the supplied timestamp', async () => {
    const ts = 1_700_000_000_000;
    sessionLog.record({
      tool: 'decode',
      operation: 'decode',
      input: 'SGVsbG8=',
      output: 'Hello',
      timestamp: ts
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(history.all.length).toBe(1);
    expect(history.all[0].startedAt).toBe(ts);
    expect(history.all[0].finishedAt).toBe(ts);
    expect(history.all[0].durationMs).toBe(0);
  });

  it('record() preserves all option keys as history params', async () => {
    sessionLog.record({
      tool: 'gibberish',
      operation: 'random-removal',
      input: 'hello world',
      output: 'helo wrld',
      options: { count: 2, seed: 42, mode: 'random' }
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(history.all[0].params).toMatchObject({
      operation: 'random-removal',
      count: 2,
      seed: 42,
      mode: 'random'
    });
  });

  it('record() works without options', async () => {
    sessionLog.record({
      tool: 'tokenizer',
      operation: 'encode',
      input: 'x',
      output: '[123]'
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(history.all.length).toBe(1);
    expect(history.all[0].params).toEqual({ operation: 'encode' });
  });

  it('recordError() pushes a status:"error" entry to history but NOT the ring', async () => {
    sessionLog.recordError({
      category: 'network',
      message: 'fetch failed',
      context: { url: 'https://example.com' },
      timestamp: 1_700_000_000_000
    });

    // The in-memory ring is for user-driven ops only; errors only land in history.
    expect(sessionLog.size).toBe(0);

    await Promise.resolve();
    await Promise.resolve();

    expect(history.all.length).toBe(1);
    const run = history.all[0];
    expect(run.status).toBe('error');
    expect(run.errorCategory).toBe('network');
    expect(run.errorMessage).toBe('fetch failed');
    expect(run.inputSummary).toBe('fetch failed');
    expect(run.outputSummary).toBe('');
    expect(run.params.category).toBe('network');
    expect(run.params.url).toBe('https://example.com');
  });

  it('multiple record() calls accumulate in both stores', async () => {
    sessionLog.record({ tool: 'transform', operation: 'a', input: '1', output: '2' });
    sessionLog.record({ tool: 'decode',    operation: 'b', input: '3', output: '4' });
    sessionLog.record({ tool: 'emoji',     operation: 'c', input: '5', output: '6' });

    await Promise.resolve();
    await Promise.resolve();

    expect(sessionLog.size).toBe(3);
    expect(history.all.length).toBe(3);
    // history is newest-first
    expect(history.all.map((r) => r.toolId)).toEqual(['emoji', 'decode', 'transform']);
  });

  it('legacy toJSON / toMarkdown still operate on the in-memory ring only', () => {
    sessionLog.record({ tool: 'transform', operation: 'encode', input: 'x', output: 'y' });
    const json = JSON.parse(sessionLog.toJSON());
    expect(json.entries.length).toBe(1);
    expect(json.entries[0].tool).toBe('transform');

    const md = sessionLog.toMarkdown();
    expect(md).toContain('## Transform');
    expect(md).toContain('### encode');
  });
});
