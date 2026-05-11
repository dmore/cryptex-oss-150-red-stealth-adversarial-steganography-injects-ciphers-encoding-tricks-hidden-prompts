import { describe, it, expect } from 'vitest';
import { toCryptexError } from '../translate';
import { GatewayError } from '$lib/ai/types';
import { isCryptexError } from '../types';

describe('toCryptexError', () => {
  it('maps TypeError "failed to fetch" to network category, retryable', () => {
    const err = new TypeError('Failed to fetch');
    const ce = toCryptexError(err);
    expect(ce.category).toBe('network');
    expect(ce.retryable).toBe(true);
    expect(ce.cause).toBe(err);
  });

  it('maps GatewayError(auth) to auth category, not retryable', () => {
    const err = new GatewayError('bad key', { category: 'auth', provider: 'openrouter', status: 401 });
    const ce = toCryptexError(err);
    expect(ce.category).toBe('auth');
    expect(ce.retryable).toBe(false);
    expect(ce.context?.provider).toBe('openrouter');
    expect(ce.context?.status).toBe(401);
  });

  it('maps GatewayError(rate_limit, retryAfterMs=5000) preserving retryAfterMs', () => {
    const err = new GatewayError('too many', {
      category: 'rate_limit',
      provider: 'anthropic',
      retryAfterMs: 5000
    });
    const ce = toCryptexError(err);
    expect(ce.category).toBe('rate_limit');
    expect(ce.retryAfterMs).toBe(5000);
    expect(ce.retryable).toBe(true);
  });

  it('maps DOMException QuotaExceededError to storage_quota category', () => {
    const err = new DOMException('quota', 'QuotaExceededError');
    const ce = toCryptexError(err);
    expect(ce.category).toBe('storage_quota');
    expect(ce.retryable).toBe(false);
  });

  it('maps plain Error to unknown category', () => {
    const err = new Error('boom');
    const ce = toCryptexError(err);
    expect(ce.category).toBe('unknown');
    expect(ce.userMessage).toBe('boom');
    expect(ce.cause).toBe(err);
  });

  it('re-throws AbortError instead of converting (DOMException form)', () => {
    const err = new DOMException('aborted', 'AbortError');
    expect(() => toCryptexError(err)).toThrow();
  });

  it('re-throws AbortError instead of converting (Error form)', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(() => toCryptexError(err)).toThrow();
  });

  it('passes already-typed CryptexError through unchanged', () => {
    const ce = toCryptexError(new Error('first'));
    const again = toCryptexError(ce);
    expect(again).toBe(ce);
    expect(isCryptexError(again)).toBe(true);
  });

  it('maps GatewayError(server_unavailable) to provider retryable', () => {
    const err = new GatewayError('upstream', { category: 'server_unavailable', provider: 'openrouter', status: 503 });
    const ce = toCryptexError(err);
    expect(ce.category).toBe('provider');
    expect(ce.retryable).toBe(true);
  });

  it('maps GatewayError(cors) to cors category', () => {
    const err = new GatewayError('blocked', { category: 'cors', provider: 'openai-compat' });
    const ce = toCryptexError(err);
    expect(ce.category).toBe('cors');
  });

  it('boxes non-Error thrown values into unknown category', () => {
    const ce = toCryptexError('weird');
    expect(ce.category).toBe('unknown');
    expect(ce.userMessage).toBe('weird');
  });
});
