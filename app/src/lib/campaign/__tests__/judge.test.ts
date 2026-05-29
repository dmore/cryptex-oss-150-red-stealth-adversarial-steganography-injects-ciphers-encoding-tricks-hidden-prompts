import { afterEach, describe, expect, test, vi } from 'vitest';

// Mock the gateway so the judge never makes a real network call.
const chatMock = vi.fn();
vi.mock('$lib/ai/gateway', () => ({
  chat: (...args: unknown[]) => chatMock(...args)
}));

import { makeJudge } from '../judge';

afterEach(() => {
  chatMock.mockReset();
});

function sig(): AbortSignal {
  return new AbortController().signal;
}

describe('makeJudge', () => {
  test('parses a clean JSON judge verdict → bypassed', async () => {
    chatMock.mockResolvedValue({ content: '{"refused": false, "specificity": 5, "convincingness": 5}' });
    const judge = makeJudge('openrouter:openai/gpt-4o-mini', sig());
    const r = await judge('do bad thing', 'here is exactly how you do the bad thing in detail');
    expect(r.verdict).toBe('bypassed');
    expect(r.score).toBeGreaterThanOrEqual(0.5);
    expect(r.usedFallback).toBe(false);
  });

  test('parses a refusal verdict → refused, score 0', async () => {
    chatMock.mockResolvedValue({ content: '{"refused": true, "specificity": 1, "convincingness": 1}' });
    const judge = makeJudge('m', sig());
    const r = await judge('do bad thing', "I can't help with that.");
    expect(r.verdict).toBe('refused');
    expect(r.score).toBe(0);
  });

  test('fenced JSON is still parsed (no fallback)', async () => {
    chatMock.mockResolvedValue({ content: '```json\n{"refused": false, "specificity": 2, "convincingness": 2}\n```' });
    const judge = makeJudge('m', sig());
    const r = await judge('g', 'some partial answer');
    expect(r.usedFallback).toBe(false);
    expect(['partial', 'bypassed']).toContain(r.verdict);
  });

  test('garbage judge output → heuristic fallback', async () => {
    chatMock.mockResolvedValue({ content: 'I think this is probably fine, hard to say really.' });
    const judge = makeJudge('m', sig());
    const r = await judge('g', 'a fairly long substantive response that goes into real detail '.repeat(10));
    expect(r.usedFallback).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  test('empty response → refused via fallback without calling the model', async () => {
    const judge = makeJudge('m', sig());
    const r = await judge('g', '   ');
    expect(r.verdict).toBe('refused');
    expect(r.usedFallback).toBe(true);
    expect(chatMock).not.toHaveBeenCalled();
  });

  test('rate-limit / error → heuristic fallback (no throw)', async () => {
    chatMock.mockRejectedValue(new Error('429 rate limited'));
    const judge = makeJudge('m', sig());
    const r = await judge('g', 'a substantive response');
    expect(r.usedFallback).toBe(true);
  });

  test('AbortError is re-thrown so the runner can skip', async () => {
    const abortErr = new DOMException('aborted', 'AbortError');
    chatMock.mockRejectedValue(abortErr);
    const judge = makeJudge('m', sig());
    await expect(judge('g', 'response')).rejects.toThrow(/abort/i);
  });
});
