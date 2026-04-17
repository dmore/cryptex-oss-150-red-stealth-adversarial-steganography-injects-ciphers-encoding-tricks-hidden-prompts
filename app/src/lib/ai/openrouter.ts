/**
 * OpenRouter client — reactive, BYOK, and aware of the live model catalog.
 *
 * Responsibilities:
 *  1. Reactive API-key state: persisted under `cryptex.openrouterApiKey`.
 *     Consuming components that read `getApiKey()` or `hasApiKey()` inside
 *     `$derived` / `$effect` auto-update when the key changes (save in
 *     Settings → PromptCraft sees key immediately, no remount needed).
 *
 *  2. Legacy-key backfill: on first read, picks up the 3 legacy slots
 *     (`openrouter-api-key`, `openrouter_api_key`, `plinyos-api-key`) and
 *     migrates them into the new reactive state.
 *
 *  3. `chat()` — single round-trip against `POST /api/v1/chat/completions`
 *     with rich error classification (401 / 402 / 403 / 404 / 429 / network
 *     / format / api). Throws `OpenRouterError` with a `category` UI can branch on.
 *
 *  4. `fetchModels()` — hits `GET /api/v1/models` so the AI tools can render
 *     a live, accurate picker instead of a hand-curated static list. Falls
 *     back to `FALLBACK_MODELS` when offline or the endpoint rejects.
 *
 *  5. `validateKey(key)` — hits `GET /api/v1/auth/key` to prove a just-entered
 *     key actually works (401 vs 402 vs ok). Used by the Settings page on save.
 */

import { browser } from '$app/environment';
import { createPersistedState } from '$lib/stores/_persisted.svelte';

// ---------------------------------------------------------------------------
// Reactive API key state
// ---------------------------------------------------------------------------

const LEGACY_KEYS = ['openrouter-api-key', 'openrouter_api_key', 'plinyos-api-key'];

// Persisted reactive key; components reading .value inside $derived track it.
const apiKey = createPersistedState<string>('cryptex.openrouterApiKey', '');

function backfillFromLegacy(): void {
  if (!browser) return;
  if (apiKey.value) return;
  for (const legacy of LEGACY_KEYS) {
    const v = (localStorage.getItem(legacy) || '').trim();
    if (!v) continue;
    apiKey.value = v;
    // Don't remove legacy key here — the one-shot migration in lib/stores/_migrate.ts owns cleanup.
    break;
  }
}

// Do the legacy backfill once on module load in the browser.
if (browser) backfillFromLegacy();

/** Read the API key. Reactive: use inside `$derived` / `$effect` to track changes. */
export function getApiKey(): string {
  return (apiKey.value || '').trim();
}

/** Update the API key. Triggers all reactive consumers. */
export function setApiKey(key: string): void {
  apiKey.value = key.trim();
}

/** Convenience: is a key currently set? Reactive. */
export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

// ---------------------------------------------------------------------------
// Error model
// ---------------------------------------------------------------------------

export type ErrorCategory =
  | 'auth'
  | 'credit'
  | 'forbidden'
  | 'not_found'
  | 'rate_limit'
  | 'network'
  | 'format'
  | 'api'
  | 'cors'
  | 'unknown';

export class OpenRouterError extends Error {
  readonly status?: number;
  readonly category: ErrorCategory;
  constructor(message: string, category: ErrorCategory, status?: number) {
    super(message);
    this.name = 'OpenRouterError';
    this.category = category;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Shared fetch helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'https://openrouter.ai/api/v1';

function commonHeaders(apiKeyOverride?: string): Record<string, string> {
  const key = apiKeyOverride ?? getApiKey();
  const referer = (browser && window.location?.origin) || 'https://cryptex.app';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'HTTP-Referer': referer,
    'X-Title': 'Cryptex'
  };
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

/**
 * OpenRouter often wraps the real upstream error in a `metadata.raw` string.
 * Example payload:
 *   { error: { message: "Provider returned error", metadata: {
 *       provider_name: "google", raw: "{\"error\":{\"message\":\"Invalid language\",...}}"
 *   } } }
 * This helper unwraps that so users see "Invalid language" instead of a
 * meaningless generic wrapper.
 */
type UpstreamError = {
  message?: string;
  code?: number;
  type?: string;
  metadata?: {
    provider_name?: string;
    raw?: string;
    reasons?: string[];
  };
};

function decodeUpstreamError(errRaw: unknown, httpStatus: number): OpenRouterError {
  const err = (typeof errRaw === 'object' && errRaw !== null ? errRaw : {}) as UpstreamError;
  const topMessage = err.message || '';
  const providerName = err.metadata?.provider_name;
  const rawPayload = err.metadata?.raw;

  // Try to pull a real message out of the wrapped raw provider payload
  let unwrapped = '';
  if (typeof rawPayload === 'string' && rawPayload) {
    try {
      const parsed = JSON.parse(rawPayload);
      const candidateMessages: string[] = [];
      const walk = (o: unknown, depth = 0): void => {
        if (depth > 4 || o === null || o === undefined) return;
        if (typeof o === 'string') return;
        if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
        if (typeof o === 'object') {
          for (const [k, v] of Object.entries(o)) {
            if (k === 'message' && typeof v === 'string' && v.length > 0) candidateMessages.push(v);
            else if (k === 'detail' && typeof v === 'string' && v.length > 0) candidateMessages.push(v);
            else walk(v, depth + 1);
          }
        }
      };
      walk(parsed);
      if (candidateMessages.length > 0) unwrapped = candidateMessages[0];
    } catch {
      // raw wasn't JSON — use it as-is if short enough
      if (rawPayload.length < 400) unwrapped = rawPayload;
    }
  }

  const reasonPart = err.metadata?.reasons?.length ? ` (${err.metadata.reasons.join(', ')})` : '';
  const providerPart = providerName ? ` [${providerName}]` : '';
  const finalMessage = (unwrapped || topMessage || `API error (${err.code ?? httpStatus})`) + providerPart + reasonPart;

  // Category derivation
  const text = `${topMessage} ${unwrapped}`.toLowerCase();
  if (err.code === 404 || /not found|does not exist/.test(text)) {
    return new OpenRouterError(finalMessage, 'not_found', httpStatus);
  }
  if (err.code === 401 || /unauthor|invalid api key/.test(text)) {
    return new OpenRouterError(finalMessage, 'auth', httpStatus);
  }
  if (err.code === 402 || /credit|balance/.test(text)) {
    return new OpenRouterError(finalMessage, 'credit', httpStatus);
  }
  if (err.code === 429 || /rate.?limit/.test(text)) {
    return new OpenRouterError(finalMessage, 'rate_limit', httpStatus);
  }
  if (err.code === 403 || /forbidden|permission|access denied/.test(text)) {
    return new OpenRouterError(finalMessage, 'forbidden', httpStatus);
  }
  return new OpenRouterError(finalMessage, 'api', httpStatus);
}

async function parseErrorResponse(resp: Response): Promise<OpenRouterError> {
  let body = '';
  try {
    body = await resp.text();
  } catch { /* ignore */ }

  if (body) {
    try {
      const json = JSON.parse(body) as { error?: UpstreamError | string };
      if (json.error && typeof json.error === 'object') {
        return decodeUpstreamError(json.error, resp.status);
      }
      if (typeof json.error === 'string' && json.error) {
        return defaultErrorForStatus(resp.status, json.error);
      }
    } catch { /* body not JSON — fall through to status-based message */ }
  }

  return defaultErrorForStatus(resp.status, body);
}

function defaultErrorForStatus(status: number, message: string): OpenRouterError {
  switch (status) {
    case 401: return new OpenRouterError(message || 'Invalid API key. Re-enter it in Settings.', 'auth', 401);
    case 402: return new OpenRouterError(message || 'Insufficient credits on your OpenRouter account.', 'credit', 402);
    case 403: return new OpenRouterError(message || 'Access denied. Your key may lack permissions for this model.', 'forbidden', 403);
    case 404: return new OpenRouterError(message || 'Not found. Check the model id.', 'not_found', 404);
    case 429: return new OpenRouterError(message || 'Rate-limited by OpenRouter. Try again shortly.', 'rate_limit', 429);
    default:  return new OpenRouterError(message || `HTTP ${status}`, 'api', status);
  }
}

// ---------------------------------------------------------------------------
// Chat completions
// ---------------------------------------------------------------------------

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  /** Label sent as X-Title so requests are identifiable in OpenRouter dashboards. */
  title?: string;
  signal?: AbortSignal;
};

export type ChatResponse = {
  content: string;
  rawModel: string;
  finishReason?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const key = getApiKey();
  if (!key) {
    throw new OpenRouterError('No API key set. Add your OpenRouter key in Settings.', 'auth');
  }

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { ...commonHeaders(key), 'X-Title': req.title ?? 'Cryptex' },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        top_p: req.top_p
      }),
      signal: req.signal
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    // Browsers that block the request (CORS/offline) throw a generic TypeError
    throw new OpenRouterError(
      `Could not reach OpenRouter: ${(err as Error).message || 'network error'}.`,
      'network'
    );
  }

  if (!resp.ok) throw await parseErrorResponse(resp);

  let data: Record<string, unknown>;
  try {
    data = (await resp.json()) as Record<string, unknown>;
  } catch {
    throw new OpenRouterError(
      `Unexpected response (HTTP ${resp.status}). OpenRouter may be returning non-JSON.`,
      'format',
      resp.status
    );
  }

  if (data.error) {
    throw decodeUpstreamError(data.error, resp.status);
  }

  const choices = (data.choices as Array<{ message?: { content?: string }; finish_reason?: string }> | undefined) || [];
  const first = choices[0];
  const content = first?.message?.content?.trim() || '';
  if (!content) throw new OpenRouterError('Empty response from model. Try a different one.', 'api', resp.status);

  return {
    content,
    rawModel: (data.model as string) || req.model,
    finishReason: first?.finish_reason,
    usage: data.usage as ChatResponse['usage']
  };
}

// ---------------------------------------------------------------------------
// Key validation
// ---------------------------------------------------------------------------

export type KeyInfo = {
  label?: string;
  limit?: number | null;
  usage?: number;
  is_free_tier?: boolean;
  rate_limit?: { requests?: number; interval?: string };
  limit_remaining?: number | null;
};

/**
 * Check a candidate key by hitting `/auth/key`. Does NOT persist the key.
 * Throws `OpenRouterError` on non-2xx with useful categorization.
 */
export async function validateKey(candidate: string, signal?: AbortSignal): Promise<KeyInfo> {
  const key = candidate.trim();
  if (!key) throw new OpenRouterError('Key is empty.', 'auth');

  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/auth/key`, {
      method: 'GET',
      headers: commonHeaders(key),
      signal
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new OpenRouterError(`Could not reach OpenRouter: ${(err as Error).message || 'network error'}.`, 'network');
  }

  if (!resp.ok) throw await parseErrorResponse(resp);

  try {
    const body = (await resp.json()) as { data?: KeyInfo };
    return body.data ?? {};
  } catch {
    throw new OpenRouterError('Unexpected /auth/key response shape.', 'format', resp.status);
  }
}

// ---------------------------------------------------------------------------
// Live model catalog
// ---------------------------------------------------------------------------

export type Model = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  provider: string;
  pricing?: { prompt?: string; completion?: string };
  top_provider?: { max_completion_tokens?: number | null; context_length?: number | null };
  modality?: string;
  /** If true, at least one endpoint is free (both prompt and completion price are "0"). */
  isFree?: boolean;
};

export type FetchModelsResult = {
  models: Model[];
  fetchedAt: number;
  live: boolean; // true if fetched from API, false if fallback
};

/**
 * Conservative fallback list for offline / first-paint scenarios.
 * The live fetch supersedes this as soon as it completes.
 */
export const FALLBACK_MODELS: ReadonlyArray<Model> = Object.freeze([
  { id: 'openrouter/auto',                      name: 'Auto (best for price)', provider: 'OpenRouter' },
  { id: 'anthropic/claude-sonnet-4.5',          name: 'Claude Sonnet 4.5',     provider: 'Anthropic' },
  { id: 'anthropic/claude-haiku-4.5',           name: 'Claude Haiku 4.5',      provider: 'Anthropic' },
  { id: 'openai/gpt-4o',                        name: 'GPT-4o',                provider: 'OpenAI' },
  { id: 'openai/gpt-4o-mini',                   name: 'GPT-4o Mini',           provider: 'OpenAI' },
  { id: 'google/gemini-2.5-flash-preview',      name: 'Gemini 2.5 Flash',      provider: 'Google' },
  { id: 'google/gemma-3-27b-it',                name: 'Gemma 3 27B',           provider: 'Google' },
  { id: 'meta-llama/llama-3.3-70b-instruct',    name: 'Llama 3.3 70B',         provider: 'Meta' },
  { id: 'deepseek/deepseek-chat-v3-0324',       name: 'DeepSeek V3',           provider: 'DeepSeek' },
  { id: 'x-ai/grok-4',                          name: 'Grok 4',                provider: 'xAI' }
]);

function deriveProvider(modelId: string): string {
  const slash = modelId.indexOf('/');
  if (slash <= 0) return 'Other';
  const raw = modelId.slice(0, slash);
  // Pretty-print: x-ai → xAI, openai → OpenAI, anthropic → Anthropic, etc.
  switch (raw) {
    case 'x-ai':              return 'xAI';
    case 'openai':            return 'OpenAI';
    case 'anthropic':         return 'Anthropic';
    case 'google':            return 'Google';
    case 'meta-llama':        return 'Meta';
    case 'deepseek':          return 'DeepSeek';
    case 'mistralai':         return 'Mistral';
    case 'qwen':              return 'Qwen';
    case 'cohere':            return 'Cohere';
    case 'perplexity':        return 'Perplexity';
    case 'nousresearch':      return 'Nous';
    case 'openrouter':        return 'OpenRouter';
    default:
      return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
}

function normalizeModel(raw: Record<string, unknown>): Model | null {
  const id = raw.id;
  if (typeof id !== 'string' || !id) return null;
  const name = (typeof raw.name === 'string' && raw.name) || id;
  const description = typeof raw.description === 'string' ? raw.description : undefined;
  const context_length = typeof raw.context_length === 'number' ? raw.context_length : undefined;
  const pricing = raw.pricing && typeof raw.pricing === 'object'
    ? raw.pricing as { prompt?: string; completion?: string }
    : undefined;
  const top_provider = raw.top_provider && typeof raw.top_provider === 'object'
    ? raw.top_provider as Model['top_provider']
    : undefined;
  const modality = typeof raw.modality === 'string' ? raw.modality : undefined;

  const promptPrice = pricing?.prompt;
  const completionPrice = pricing?.completion;
  const isFree =
    (promptPrice === '0' || promptPrice === '0.0' || Number(promptPrice) === 0) &&
    (completionPrice === '0' || completionPrice === '0.0' || Number(completionPrice) === 0);

  return {
    id,
    name,
    description,
    context_length,
    pricing,
    top_provider,
    modality,
    provider: deriveProvider(id),
    isFree
  };
}

/**
 * GET /api/v1/models. Sends the API key if set (so OpenRouter returns
 * user-specific availability, which may filter out provider-blocked models).
 * Returns a normalized, alpha-sorted list.
 */
export async function fetchModels(signal?: AbortSignal): Promise<FetchModelsResult> {
  let resp: Response;
  try {
    resp = await fetch(`${BASE_URL}/models`, {
      method: 'GET',
      headers: commonHeaders(),
      signal
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new OpenRouterError(
      `Could not reach OpenRouter: ${(err as Error).message || 'network error'}.`,
      'network'
    );
  }

  if (!resp.ok) throw await parseErrorResponse(resp);

  let body: { data?: Array<Record<string, unknown>> };
  try {
    body = (await resp.json()) as typeof body;
  } catch {
    throw new OpenRouterError('Unexpected /models response shape.', 'format', resp.status);
  }

  const raw = body.data ?? [];
  const models: Model[] = [];
  for (const entry of raw) {
    const m = normalizeModel(entry);
    if (m) models.push(m);
  }
  models.sort((a, b) => {
    // Pin 'openrouter/auto' first, then alphabetical by name
    if (a.id === 'openrouter/auto') return -1;
    if (b.id === 'openrouter/auto') return 1;
    return a.name.localeCompare(b.name);
  });

  return { models, fetchedAt: Date.now(), live: true };
}
