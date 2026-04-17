/**
 * Coverage for the OpenRouter client — key storage round-trip, model
 * normalization, error classification.
 *
 * Integration tests against the live API are not included here; the live
 * endpoints are exercised via the in-browser AI tools directly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FALLBACK_MODELS,
  OpenRouterError,
  getApiKey,
  setApiKey,
  hasApiKey,
  fetchModels,
  validateKey
} from './openrouter';

function mockLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => { store.set(k, v); }),
    removeItem: vi.fn((k: string) => { store.delete(k); }),
    clear: vi.fn(() => { store.clear(); }),
    get length() { return store.size; },
    key: vi.fn((i: number) => [...store.keys()][i] ?? null)
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, writable: true, configurable: true });
  return { store };
}

beforeEach(() => {
  mockLocalStorage();
  // Clean any persisted state between tests
  localStorage.clear();
});

describe('API key state', () => {
  it('empty by default', () => {
    expect(getApiKey()).toBe('');
    expect(hasApiKey()).toBe(false);
  });

  it('round-trips a key', () => {
    setApiKey('sk-or-v1-abc123');
    expect(getApiKey()).toBe('sk-or-v1-abc123');
    expect(hasApiKey()).toBe(true);
  });

  it('trims whitespace on save', () => {
    setApiKey('   sk-or-v1-abc   ');
    expect(getApiKey()).toBe('sk-or-v1-abc');
  });

  it('clears when set to empty string', () => {
    setApiKey('sk-or-v1-xxx');
    expect(hasApiKey()).toBe(true);
    setApiKey('');
    expect(hasApiKey()).toBe(false);
    expect(getApiKey()).toBe('');
  });
});

describe('FALLBACK_MODELS', () => {
  it('contains openrouter/auto as a safe default', () => {
    expect(FALLBACK_MODELS.some((m) => m.id === 'openrouter/auto')).toBe(true);
  });
  it('all entries have id, name, provider', () => {
    for (const m of FALLBACK_MODELS) {
      expect(m.id).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.provider).toBeTruthy();
    }
  });
});

describe('fetchModels', () => {
  it('parses and normalizes the OpenRouter response', async () => {
    const fakeResponse = {
      data: [
        {
          id: 'anthropic/claude-sonnet-4.5',
          name: 'Claude Sonnet 4.5',
          description: 'Anthropic flagship',
          context_length: 200000,
          pricing: { prompt: '0.000003', completion: '0.000015' }
        },
        {
          id: 'google/gemma-3-27b-it:free',
          name: 'Gemma 3 27B (free)',
          context_length: 8192,
          pricing: { prompt: '0', completion: '0' }
        },
        {
          id: 'openrouter/auto',
          name: 'Auto (best for price)',
          pricing: { prompt: '-1', completion: '-1' }
        }
      ]
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(fakeResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const result = await fetchModels();
    expect(result.live).toBe(true);
    expect(result.models.length).toBe(3);

    // openrouter/auto is pinned first
    expect(result.models[0].id).toBe('openrouter/auto');

    const claude = result.models.find((m) => m.id === 'anthropic/claude-sonnet-4.5')!;
    expect(claude.provider).toBe('Anthropic');
    expect(claude.context_length).toBe(200000);
    expect(claude.isFree).toBe(false);

    const gemma = result.models.find((m) => m.id.startsWith('google/gemma-3-27b-it'))!;
    expect(gemma.provider).toBe('Google');
    expect(gemma.isFree).toBe(true);
  });

  it('throws OpenRouterError with category=auth on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Invalid key', code: 401 } }), { status: 401 })
    );
    await expect(fetchModels()).rejects.toBeInstanceOf(OpenRouterError);
    try {
      await fetchModels();
    } catch (err) {
      expect((err as OpenRouterError).category).toBe('auth');
      expect((err as OpenRouterError).status).toBe(401);
    }
  });

  it('throws OpenRouterError with category=network when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    try {
      await fetchModels();
    } catch (err) {
      expect(err).toBeInstanceOf(OpenRouterError);
      expect((err as OpenRouterError).category).toBe('network');
    }
  });
});

describe('validateKey', () => {
  it('returns KeyInfo on successful validation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: { label: 'Test key', limit: 5.0, usage: 0.123, is_free_tier: false }
      }), { status: 200 })
    );
    const info = await validateKey('sk-or-v1-valid');
    expect(info.label).toBe('Test key');
    expect(info.limit).toBe(5.0);
    expect(info.usage).toBe(0.123);
    expect(info.is_free_tier).toBe(false);
  });

  it('rejects on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'bad key' }), { status: 401 })
    );
    try {
      await validateKey('sk-or-bogus');
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OpenRouterError);
      expect((err as OpenRouterError).category).toBe('auth');
    }
  });

  it('rejects empty key without hitting network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      await validateKey('');
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OpenRouterError);
      expect((err as OpenRouterError).category).toBe('auth');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
