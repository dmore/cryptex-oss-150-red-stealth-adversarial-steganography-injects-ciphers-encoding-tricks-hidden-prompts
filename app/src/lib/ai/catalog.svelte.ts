import { browser } from '$app/environment';
import type { Model } from './types';
import { listProviders } from './providers.svelte';
import { openrouterAdapter } from './adapters/openrouter';
import { anthropicAdapter } from './adapters/anthropic';
import { openaiCompatAdapter } from './adapters/openai-compat';

const FALLBACK_MODELS: ReadonlyArray<Model> = Object.freeze([
  { id: 'openrouter/auto',                      qualifiedId: 'openrouter:openrouter/auto',                      name: 'Auto (best for price)', provider: 'openrouter', upstreamProvider: 'OpenRouter' },
  { id: 'anthropic/claude-sonnet-4.5',          qualifiedId: 'openrouter:anthropic/claude-sonnet-4.5',          name: 'Claude Sonnet 4.5',     provider: 'openrouter', upstreamProvider: 'Anthropic' },
  { id: 'anthropic/claude-haiku-4.5',           qualifiedId: 'openrouter:anthropic/claude-haiku-4.5',           name: 'Claude Haiku 4.5',      provider: 'openrouter', upstreamProvider: 'Anthropic' },
  { id: 'openai/gpt-4o',                        qualifiedId: 'openrouter:openai/gpt-4o',                        name: 'GPT-4o',                provider: 'openrouter', upstreamProvider: 'OpenAI' },
  { id: 'openai/gpt-4o-mini',                   qualifiedId: 'openrouter:openai/gpt-4o-mini',                   name: 'GPT-4o Mini',           provider: 'openrouter', upstreamProvider: 'OpenAI' },
  { id: 'google/gemini-2.5-flash-preview',      qualifiedId: 'openrouter:google/gemini-2.5-flash-preview',      name: 'Gemini 2.5 Flash',      provider: 'openrouter', upstreamProvider: 'Google' },
  { id: 'google/gemma-3-27b-it',                qualifiedId: 'openrouter:google/gemma-3-27b-it',                name: 'Gemma 3 27B',           provider: 'openrouter', upstreamProvider: 'Google' },
  { id: 'meta-llama/llama-3.3-70b-instruct',    qualifiedId: 'openrouter:meta-llama/llama-3.3-70b-instruct',    name: 'Llama 3.3 70B',         provider: 'openrouter', upstreamProvider: 'Meta' },
  { id: 'deepseek/deepseek-chat-v3-0324',       qualifiedId: 'openrouter:deepseek/deepseek-chat-v3-0324',       name: 'DeepSeek V3',           provider: 'openrouter', upstreamProvider: 'DeepSeek' },
  { id: 'x-ai/grok-4',                          qualifiedId: 'openrouter:x-ai/grok-4',                          name: 'Grok 4',                provider: 'openrouter', upstreamProvider: 'xAI' }
]);

const CACHE_KEY = 'cryptex.catalogCache.v2';
const CACHE_TTL_MS = 60 * 60 * 1000;

type Status = 'idle' | 'loading' | 'ready' | 'error';
/**
 * Per-provider catalog fetch status. Reported separately from the global
 * Status so the UI can distinguish "live model list from upstream" (ok) vs
 * "upstream blocked /models — using shipped fallback" (fallback) vs
 * "upstream returned an unrecoverable error" (error). Used in Settings to
 * show a small badge on each provider card.
 */
export type ProviderCatalogStatus = 'ok' | 'fallback' | 'error';
export type ProviderCatalogStatuses = Record<string, ProviderCatalogStatus>;

type CacheShape = { models: Model[]; fetchedAt: number };

let status = $state<Status>('idle');
let items = $state<Model[]>([]);
let fetchedAt = $state<number | null>(null);
let error = $state<string>('');
let providerStatuses = $state<ProviderCatalogStatuses>({});
let abortController: AbortController | null = null;

/**
 * Build the lookup key for a provider's status entry. For openrouter and
 * anthropic the provider id is unique; openai-compat instances are keyed by
 * `openai-compat:<instanceId>` so multiple instances each have their own
 * status entry.
 */
export function providerStatusKey(p: { id: string; instanceId?: string }): string {
  if (p.id === 'openai-compat' && p.instanceId) return `openai-compat:${p.instanceId}`;
  return p.id;
}

/**
 * Adapters call this from inside `fetchCatalog` to report whether the live
 * `/v1/models` request succeeded, fell back to the per-preset default list,
 * or errored entirely. The catalog reads it back into the reactive
 * `providerStatuses` map after the fetch round-robin completes.
 *
 * Stored on a module-level Map keyed by providerStatusKey() so it works
 * across the lazy import boundary between catalog.svelte.ts and the adapters.
 */
const _pendingStatuses = new Map<string, ProviderCatalogStatus>();

export function reportCatalogStatus(
  key: string,
  status: ProviderCatalogStatus
): void {
  _pendingStatuses.set(key, status);
}

function loadCache(): CacheShape | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape;
  } catch { return null; }
}
function saveCache(models: Model[], ts: number): void {
  if (!browser) return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ models, fetchedAt: ts })); } catch { /* ignore */ }
}

async function fetchAll(signal: AbortSignal): Promise<Model[]> {
  const providers = listProviders().filter((p) => p.enabled);
  const results: Model[] = [];
  // Reset pending statuses; adapters re-populate during their fetchCatalog calls.
  _pendingStatuses.clear();
  for (const p of providers) {
    const key = providerStatusKey(p as { id: string; instanceId?: string });
    try {
      switch (p.id) {
        case 'openrouter': {
          const a = openrouterAdapter(p);
          results.push(...await a.fetchCatalog(signal));
          // OpenRouter adapter throws on /models failure rather than falling back,
          // so reaching here means the response was live and parsed cleanly.
          if (!_pendingStatuses.has(key)) _pendingStatuses.set(key, 'ok');
          break;
        }
        case 'anthropic': {
          const a = anthropicAdapter(p);
          results.push(...await a.fetchCatalog(signal));
          // Anthropic ships a static catalog; the SDK has no /models endpoint.
          // Treat the static list as 'ok' since it's the canonical source.
          if (!_pendingStatuses.has(key)) _pendingStatuses.set(key, 'ok');
          break;
        }
        case 'openai-compat': {
          const a = openaiCompatAdapter(p);
          results.push(...await a.fetchCatalog(signal));
          // openai-compat adapter calls reportCatalogStatus() itself with
          // 'ok' or 'fallback' depending on whether /models returned data.
          if (!_pendingStatuses.has(key)) _pendingStatuses.set(key, 'ok');
          break;
        }
      }
    } catch (e) {
      // per-provider failure does not fail the whole catalog
      if ((e as Error)?.name === 'AbortError') throw e;
      console.warn(`[catalog] ${p.id} fetch failed:`, e);
      _pendingStatuses.set(key, 'error');
    }
  }
  // Flush pending statuses into reactive state so UI updates.
  providerStatuses = Object.fromEntries(_pendingStatuses);
  return results;
}

export async function refreshCatalog(force = false, signal?: AbortSignal): Promise<void> {
  if (!browser) return;
  if (!force && fetchedAt && Date.now() - fetchedAt < CACHE_TTL_MS && items.length > 0) return;
  if (abortController) abortController.abort();
  abortController = new AbortController();
  signal?.addEventListener('abort', () => abortController?.abort(), { once: true });
  status = 'loading';
  error = '';
  try {
    const models = await fetchAll(abortController.signal);
    items = models;
    fetchedAt = Date.now();
    status = 'ready';
    saveCache(models, fetchedAt);
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
    error = (e as Error)?.message ?? 'catalog fetch failed';
    status = 'error';
  } finally {
    abortController = null;
  }
}

function hydrate(): void {
  if (status !== 'idle') return;
  const cached = loadCache();
  if (cached) { items = cached.models; fetchedAt = cached.fetchedAt; status = 'ready'; }
}

export const catalog = {
  get status(): Status { return status; },
  get error(): string { return error; },
  get list(): ReadonlyArray<Model> { return items.length > 0 ? items : FALLBACK_MODELS; },
  get isLive(): boolean { return items.length > 0; },
  get fetchedAt(): number | null { return fetchedAt; },
  /**
   * Per-provider fetch status. Keys are providerStatusKey() values
   * (e.g. `openrouter`, `anthropic`, `openai-compat:<instanceId>`); value is
   * 'ok' (live /models succeeded), 'fallback' (live /models failed, served
   * shipped per-preset list), or 'error' (provider threw and emitted nothing).
   * Empty before the first refresh.
   */
  get providerStatuses(): ProviderCatalogStatuses { return providerStatuses; },
  refresh(force = true): Promise<void> { return refreshCatalog(force); },
  find(qualifiedId: string): Model | undefined {
    const list = items.length > 0 ? items : FALLBACK_MODELS;
    return list.find((m) => m.qualifiedId === qualifiedId || m.id === qualifiedId);
  },
  get byUpstream(): Record<string, Model[]> {
    const list = items.length > 0 ? items : FALLBACK_MODELS;
    const out: Record<string, Model[]> = {};
    for (const m of list) (out[m.upstreamProvider || 'Other'] ||= []).push(m);
    return out;
  }
};

export function initCatalogStore(): void {
  if (!browser) return;
  hydrate();
  if (status === 'idle' || (fetchedAt && Date.now() - fetchedAt > CACHE_TTL_MS)) {
    queueMicrotask(() => { refreshCatalog(false); });
  }
}
