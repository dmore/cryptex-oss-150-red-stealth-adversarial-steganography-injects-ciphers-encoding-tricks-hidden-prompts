import { GatewayError } from '$lib/ai/types';
import type { CryptexError, ErrorCategory } from './types';
import { Errors, isCryptexError, cryptexError } from './types';

/**
 * Convert any thrown value into a typed CryptexError. AbortError is left
 * to propagate — callers handle cancellation as a non-error path.
 */
export function toCryptexError(
  err: unknown,
  context?: Record<string, unknown>
): CryptexError {
  // Already typed
  if (isCryptexError(err)) return err;

  // Cancellation never becomes a CryptexError
  if (err instanceof DOMException && err.name === 'AbortError') throw err;
  if (err instanceof Error && err.name === 'AbortError') throw err;

  // Existing GatewayError → CryptexError translation
  if (err instanceof GatewayError) {
    const cat = err.category;
    const map: Record<string, ErrorCategory> = {
      auth: 'auth',
      credit: 'auth',
      forbidden: 'auth',
      not_found: 'provider',
      rate_limit: 'rate_limit',
      network: 'network',
      format: 'tool',
      cors: 'cors',
      api: 'provider',
      server_unavailable: 'provider',
      unknown: 'unknown'
    };
    return cryptexError({
      category: map[cat] ?? 'unknown',
      userMessage: err.message,
      devMessage: err.message,
      retryable: cat === 'rate_limit' || cat === 'network' || cat === 'server_unavailable',
      cause: err,
      context: { ...context, provider: err.provider, status: err.status },
      retryAfterMs: err.retryAfterMs
    });
  }

  // Browser fetch failures
  if (err instanceof TypeError && /failed to fetch|network/i.test(err.message)) {
    return Errors.network(err.message, err, context);
  }

  // localStorage quota
  if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
    return Errors.storageQuota('Browser storage full.', err, context);
  }

  // Plain Error
  if (err instanceof Error) {
    return Errors.unknown(err.message, err, context);
  }

  // Anything else — stringify and box
  return Errors.unknown(String(err), err, context);
}
