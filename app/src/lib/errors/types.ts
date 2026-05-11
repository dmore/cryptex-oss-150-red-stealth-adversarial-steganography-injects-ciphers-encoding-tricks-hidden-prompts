/**
 * Cryptex error taxonomy. Every catch path in the codebase routes through
 * errorLogger.report() with one of these typed errors. UI uses the category
 * to pick the right icon and copy.
 */

export type ErrorCategory =
  | 'network'          // fetch failed, DNS, transient drop
  | 'cors'             // CORS preflight or response blocked
  | 'auth'             // 401/403, invalid API key
  | 'provider'         // upstream provider returned a 4xx/5xx other than auth
  | 'rate_limit'       // 429, with optional retryAfterMs
  | 'bad_input'        // user-supplied input violates a constraint
  | 'tool'             // tool-internal logic failure (parsing, scoring, etc.)
  | 'worker'           // Web Worker crashed, terminated, or postMessage error
  | 'storage_quota'    // localStorage/IndexedDB write hit quota
  | 'local_server_offline'  // local AI server (Ollama, LM Studio, etc.) unreachable
  | 'unknown';         // last-resort bucket

export interface CryptexError {
  readonly category: ErrorCategory;
  /** Short user-friendly sentence shown in the ErrorPanel. */
  readonly userMessage: string;
  /** Detailed message for devs/log/copy-details. May include stack snippets. */
  readonly devMessage: string;
  /** True when the action that produced this is safe to retry without user changes. */
  readonly retryable: boolean;
  /** Original thrown value (Error instance, fetch Response body, etc.). Opaque. */
  readonly cause?: unknown;
  /** Free-form context (tool id, model id, input length, etc.) for logging. */
  readonly context?: Record<string, unknown>;
  /** Optional retry-after delay in ms (rate_limit). */
  readonly retryAfterMs?: number;
}

/** Constructor helper — produces a frozen CryptexError. */
export function cryptexError(init: {
  category: ErrorCategory;
  userMessage: string;
  devMessage?: string;
  retryable?: boolean;
  cause?: unknown;
  context?: Record<string, unknown>;
  retryAfterMs?: number;
}): CryptexError {
  return Object.freeze({
    category: init.category,
    userMessage: init.userMessage,
    devMessage: init.devMessage ?? init.userMessage,
    retryable: init.retryable ?? false,
    cause: init.cause,
    context: init.context,
    retryAfterMs: init.retryAfterMs
  });
}

/** Convenience factories per common case. */
export const Errors = {
  network: (msg: string, cause?: unknown, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'network', userMessage: msg || 'Network request failed.', retryable: true, cause, context: ctx }),
  cors: (msg: string, cause?: unknown, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'cors', userMessage: msg || "Blocked by CORS — the server didn't allow this request.", retryable: false, cause, context: ctx }),
  auth: (msg: string, cause?: unknown, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'auth', userMessage: msg || 'Authentication failed — check the API key in Settings.', retryable: false, cause, context: ctx }),
  provider: (msg: string, status?: number, cause?: unknown, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'provider', userMessage: msg || `Provider error (${status ?? '?'}).`, retryable: status === undefined ? false : status >= 500, cause, context: { ...ctx, status } }),
  rateLimit: (msg: string, retryAfterMs?: number, cause?: unknown, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'rate_limit', userMessage: msg || 'Rate limit — too many requests.', retryable: true, retryAfterMs, cause, context: ctx }),
  badInput: (msg: string, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'bad_input', userMessage: msg, retryable: false, context: ctx }),
  tool: (msg: string, cause?: unknown, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'tool', userMessage: msg, retryable: true, cause, context: ctx }),
  worker: (msg: string, cause?: unknown, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'worker', userMessage: msg || 'Worker crashed — please retry.', retryable: true, cause, context: ctx }),
  storageQuota: (msg: string, cause?: unknown, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'storage_quota', userMessage: msg || 'Storage full — clear older history to free space.', retryable: false, cause, context: ctx }),
  localServerOffline: (server: string, cause?: unknown, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'local_server_offline', userMessage: `${server} isn't reachable — is it running?`, retryable: true, cause, context: { ...ctx, server } }),
  unknown: (msg: string, cause?: unknown, ctx?: Record<string, unknown>): CryptexError =>
    cryptexError({ category: 'unknown', userMessage: msg || 'Something went wrong.', retryable: false, cause, context: ctx })
};

/** Type guard. */
export function isCryptexError(v: unknown): v is CryptexError {
  return typeof v === 'object' && v !== null && 'category' in v && 'userMessage' in v;
}
