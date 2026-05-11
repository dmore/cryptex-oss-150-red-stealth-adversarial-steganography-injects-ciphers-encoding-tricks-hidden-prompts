import { describe, it, expect, beforeEach } from 'vitest';
import { history, record, list, search, _resetForTests } from '../store.svelte';

// IndexedDB is not implemented by jsdom (and fake-indexeddb isn't installed),
// so probeIdb() returns false and the localStorage fallback path is exercised.

beforeEach(() => {
  _resetForTests();
  localStorage.clear();
});

describe('history v2 store', () => {
  it('record() creates an entry and returns it', async () => {
    const before = Date.now();
    const run = await record({
      toolId: 'transforms',
      startedAt: before - 50,
      finishedAt: before,
      status: 'done',
      input: 'hello',
      output: 'olleh',
      params: { transform: 'reverse' }
    });
    expect(run.id).toMatch(/^r_/);
    expect(run.schemaVersion).toBe(1);
    expect(run.toolId).toBe('transforms');
    expect(run.status).toBe('done');
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(run.inputSummary).toBe('hello');
    expect(run.outputSummary).toBe('olleh');
    expect(history.all.length).toBe(1);
    expect(history.all[0].id).toBe(run.id);
  });

  it('record() truncates summaries > 2 KB', async () => {
    const big = 'A'.repeat(5000);
    const run = await record({
      toolId: 'transforms',
      startedAt: Date.now(),
      status: 'done',
      input: big,
      output: big,
      params: {}
    });
    expect(run.inputSummary.length).toBeLessThanOrEqual(2049); // 2048 + ellipsis
    expect(run.inputSummary.endsWith('…')).toBe(true);
    expect(run.outputSummary.endsWith('…')).toBe(true);
  });

  it('list(toolId) filters correctly', async () => {
    await record({ toolId: 'transforms', startedAt: 1, status: 'done', input: 'a', output: 'a', params: {} });
    await record({ toolId: 'decode', startedAt: 2, status: 'done', input: 'b', output: 'b', params: {} });
    await record({ toolId: 'transforms', startedAt: 3, status: 'done', input: 'c', output: 'c', params: {} });

    const t = list('transforms');
    expect(t.length).toBe(2);
    expect(t.every((r) => r.toolId === 'transforms')).toBe(true);

    const d = list('decode');
    expect(d.length).toBe(1);
    expect(d[0].toolId).toBe('decode');

    const all = list();
    expect(all.length).toBe(3);
  });

  it('search by text matches input/output/annotation', async () => {
    const a = await record({
      toolId: 'transforms',
      startedAt: 1,
      status: 'done',
      input: 'hello world',
      output: 'olleh',
      params: {}
    });
    await record({
      toolId: 'transforms',
      startedAt: 2,
      status: 'done',
      input: 'goodbye',
      output: 'eybdoog',
      params: {}
    });
    history.annotate(a.id, 'my favorite reversal');

    expect(search({ text: 'world' }).map((r) => r.id)).toEqual([a.id]);
    expect(search({ text: 'goodbye' }).length).toBe(1);
    expect(search({ text: 'favorite' }).map((r) => r.id)).toEqual([a.id]);
    expect(search({ text: 'OLLEH' }).map((r) => r.id)).toEqual([a.id]); // case-insensitive
  });

  it('search by status', async () => {
    await record({ toolId: 'a', startedAt: 1, status: 'done', input: '', output: '', params: {} });
    await record({ toolId: 'a', startedAt: 2, status: 'error', input: '', output: '', params: {}, errorMessage: 'boom' });
    await record({ toolId: 'a', startedAt: 3, status: 'cancelled', input: '', output: '', params: {} });

    expect(search({ status: 'done' }).length).toBe(1);
    expect(search({ status: 'error' }).length).toBe(1);
    expect(search({ status: 'cancelled' }).length).toBe(1);
  });

  it('search by pinnedOnly', async () => {
    const a = await record({ toolId: 'a', startedAt: 1, status: 'done', input: '', output: '', params: {} });
    await record({ toolId: 'a', startedAt: 2, status: 'done', input: '', output: '', params: {} });

    expect(search({ pinnedOnly: true }).length).toBe(0);
    history.pin(a.id);
    expect(search({ pinnedOnly: true }).map((r) => r.id)).toEqual([a.id]);
  });

  it('search by since/until window', async () => {
    await record({ toolId: 'a', startedAt: 100, status: 'done', input: '', output: '', params: {} });
    await record({ toolId: 'a', startedAt: 200, status: 'done', input: '', output: '', params: {} });
    await record({ toolId: 'a', startedAt: 300, status: 'done', input: '', output: '', params: {} });

    expect(search({ since: 150 }).map((r) => r.startedAt).sort()).toEqual([200, 300]);
    expect(search({ until: 250 }).map((r) => r.startedAt).sort()).toEqual([100, 200]);
    expect(search({ since: 150, until: 250 }).map((r) => r.startedAt)).toEqual([200]);
  });

  it('pin toggles', async () => {
    const r = await record({ toolId: 'a', startedAt: 1, status: 'done', input: '', output: '', params: {} });
    expect(history.all[0].pinned).toBeFalsy();
    history.pin(r.id);
    expect(history.all[0].pinned).toBe(true);
    history.pin(r.id);
    expect(history.all[0].pinned).toBeFalsy();
  });

  it('annotate sets and clears annotation', async () => {
    const r = await record({ toolId: 'a', startedAt: 1, status: 'done', input: '', output: '', params: {} });
    history.annotate(r.id, 'note text');
    expect(history.all[0].annotation).toBe('note text');
    history.annotate(r.id, '');
    expect(history.all[0].annotation).toBeUndefined();
  });

  it('clear() removes everything', async () => {
    await record({ toolId: 'a', startedAt: 1, status: 'done', input: '', output: '', params: {} });
    await record({ toolId: 'b', startedAt: 2, status: 'done', input: '', output: '', params: {} });
    expect(history.all.length).toBe(2);
    history.clear();
    expect(history.all.length).toBe(0);
  });

  it('clear(toolId) only removes that tool', async () => {
    await record({ toolId: 'a', startedAt: 1, status: 'done', input: '', output: '', params: {} });
    await record({ toolId: 'b', startedAt: 2, status: 'done', input: '', output: '', params: {} });
    history.clear('a');
    expect(history.all.length).toBe(1);
    expect(history.all[0].toolId).toBe('b');
  });

  it('exportJson() produces valid JSON', async () => {
    await record({ toolId: 'a', startedAt: 1, status: 'done', input: 'in', output: 'out', params: { k: 'v' } });
    const json = history.exportJson();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].toolId).toBe('a');
    expect(parsed[0].params.k).toBe('v');
  });

  it('getPayload() returns full text from fallback', async () => {
    const big = 'X'.repeat(3000);
    const r = await record({
      toolId: 'a',
      startedAt: 1,
      status: 'done',
      input: big,
      output: big,
      params: {}
    });
    expect(r.inputSummary.endsWith('…')).toBe(true);

    const full = await history.getPayload(r.id);
    expect(full).not.toBeNull();
    expect(full!.input.length).toBe(3000);
    expect(full!.output.length).toBe(3000);
  });

  it('persists index across simulated reload (saveIndex/loadIndex)', async () => {
    await record({ toolId: 'a', startedAt: 1, status: 'done', input: 'persistme', output: '', params: {} });
    const raw = localStorage.getItem('cryptex.history.index.v2');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].inputSummary).toBe('persistme');
  });
});
