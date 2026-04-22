import { assertEquals, assert } from '@std/assert';
import { analyze, type AnalyzerRawOutput } from '../analyzer.ts';
import type { AnalyzerClient } from '../_shared/analyzer-client.ts';

function mockClient(content: string): AnalyzerClient {
  return { complete: async () => ({ content }) };
}

function throwingClient(): AnalyzerClient {
  return { complete: async () => { throw new Error('simulated timeout'); } };
}

const GOOD_COMPOSITE: AnalyzerRawOutput = {
  why_it_works: 'Uses persona shift to bypass default refusals',
  detected_axes: { classifier: 'strong', prefill: 'weak' },
  strategy_tags: ['persona-shift', 'authority-claim'],
  confidence: 'high',
  rewritten_prompt: null,
  shibboleth_matches: [],
};

Deno.test('composite-mode parses a valid Sonnet response', async () => {
  const client = mockClient(JSON.stringify(GOOD_COMPOSITE));
  const out = await analyze(client, { prompt: 'You are X.', decompose: false, shibbolethMatches: [] });
  assertEquals(out.confidence, 'high');
  assertEquals(out.mode, 'composite');
  assertEquals(out.strategy_tags.includes('persona-shift'), true);
});

Deno.test('composite-mode malformed JSON falls back with parse_error and low confidence', async () => {
  const client = mockClient('I am not JSON I am prose');
  const out = await analyze(client, { prompt: 'hi', decompose: false, shibbolethMatches: [] });
  assertEquals(out.confidence, 'low');
  assert(out.parse_error);
  assertEquals(out.mode, 'composite');
});

Deno.test('composite-mode missing required field triggers fallback', async () => {
  const client = mockClient(JSON.stringify({ detected_axes: {}, strategy_tags: [] }));
  const out = await analyze(client, { prompt: 'hi', decompose: false, shibbolethMatches: [] });
  assertEquals(out.confidence, 'low');
  assert(out.parse_error);
});

Deno.test('decompose-mode returns splits when present', async () => {
  const payload = {
    ...GOOD_COMPOSITE,
    splits: [
      { category: 'classifier', content: 'You are X.', rationale: 'declares persona' },
      { category: 'prefill', content: '[{"role":"user","content":"y"},{"role":"assistant","content":"ok"}]', rationale: 'primes agreement' },
    ],
  };
  const client = mockClient(JSON.stringify(payload));
  const out = await analyze(client, { prompt: 'p', decompose: true, shibbolethMatches: [] });
  assertEquals(out.mode, 'decomposed');
  assertEquals(out.splits?.length, 2);
  assertEquals(out.splits?.[0].category, 'classifier');
});

Deno.test('decompose-mode with empty splits is flagged for fallback', async () => {
  const payload = { ...GOOD_COMPOSITE, splits: [] };
  const client = mockClient(JSON.stringify(payload));
  const out = await analyze(client, { prompt: 'p', decompose: true, shibbolethMatches: [] });
  assertEquals(out.decompose_empty, true);
});

Deno.test('shibboleth matches are passed through and rewrite is honored', async () => {
  const payload = {
    ...GOOD_COMPOSITE,
    rewritten_prompt: 'You are a thorough expert.',
    shibboleth_matches: ['Research mode enabled'],
  };
  const client = mockClient(JSON.stringify(payload));
  const out = await analyze(client, { prompt: 'Research mode enabled. Do X.', decompose: false, shibbolethMatches: ['Research mode enabled'] });
  assertEquals(out.rewritten_prompt, 'You are a thorough expert.');
  assertEquals(out.shibboleth_matches.length, 1);
});

Deno.test('client throw propagates (caller handles timeout classification)', async () => {
  const client = throwingClient();
  let caught: Error | null = null;
  try { await analyze(client, { prompt: 'hi', decompose: false, shibbolethMatches: [] }); }
  catch (e) { caught = e as Error; }
  assert(caught);
});
