import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * The shared-context store is a module-scope singleton over a localStorage
 * key. We reset the module + storage between cases so each test sees a fresh
 * default.
 */
async function freshStore() {
  vi.resetModules();
  const mod = await import('../context.svelte');
  return mod.sharedContext;
}

beforeEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

afterEach(() => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

describe('sharedContext', () => {
  test('defaults are empty (so a tool first-read is a no-op)', async () => {
    const ctx = await freshStore();
    expect(ctx.goal).toBe('');
    expect(ctx.targetModel).toBe('');
    expect(ctx.hasTarget).toBe(false);
  });

  test('set() merges a partial patch', async () => {
    const ctx = await freshStore();
    ctx.set({ goal: 'test goal' });
    expect(ctx.goal).toBe('test goal');
    expect(ctx.targetModel).toBe(''); // untouched
    ctx.set({ targetModel: 'openrouter:openai/gpt-4o' });
    expect(ctx.goal).toBe('test goal'); // preserved
    expect(ctx.targetModel).toBe('openrouter:openai/gpt-4o');
    expect(ctx.hasTarget).toBe(true);
  });

  test('setters round-trip', async () => {
    const ctx = await freshStore();
    ctx.goal = 'g';
    ctx.targetModel = 'anthropic:claude-sonnet-4-5';
    expect(ctx.goal).toBe('g');
    expect(ctx.targetModel).toBe('anthropic:claude-sonnet-4-5');
  });

  test('does NOT touch any existing per-tool key (back-compat)', async () => {
    // Seed a pre-existing per-tool pref the way the real app would.
    const SEED = JSON.stringify('openrouter:openai/gpt-4o-mini');
    localStorage.setItem('cryptex.pc.model', SEED);
    const ctx = await freshStore();
    ctx.set({ goal: 'x', targetModel: 'openrouter:meta-llama/llama-3.3-70b-instruct' });
    // The real back-compat guarantee: the campaign context never reads, writes,
    // or migrates a tool's own key. (The localStorage write of cryptex.context
    // itself is driven by Svelte's $effect.root and flushes async, so we assert
    // the in-memory value here rather than racing the effect.)
    expect(localStorage.getItem('cryptex.pc.model')).toBe(SEED);
    expect(ctx.targetModel).toContain('llama-3.3-70b');
  });
});
