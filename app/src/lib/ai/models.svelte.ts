/**
 * Reactive OpenRouter model catalog.
 *
 * - Single source of truth for the live model list across PromptCraft,
 *   Anti-Classifier, Translate, and any future AI tool.
 * - Cached in localStorage under `cryptex.openrouterModelsCache` with a
 *   1-hour TTL so tab navigation doesn't trigger redundant requests.
 * - Auto-fetches when the API key changes (including on first save after
 *   no key set) via the $effect below.
 * - Degrades gracefully: if offline or the endpoint rejects, `models`
 *   returns `FALLBACK_MODELS` so the picker never breaks.
 */

import { browser } from '$app/environment';
import {
  fetchModels as fetchModelsApi,
  FALLBACK_MODELS,
  getApiKey,
  type Model,
  OpenRouterError
} from './openrouter';

const CACHE_KEY = 'cryptex.openrouterModelsCache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type CacheShape = { models: Model[]; fetchedAt: number };

type Status = 'idle' | 'loading' | 'ready' | 'error';

let status = $state<Status>('idle');
let items = $state<Model[]>([]);
let fetchedAt = $state<number | null>(null);
let error = $state<string>('');
let abortController: AbortController | null = null;

function loadCache(): CacheShape | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    if (!parsed || !Array.isArray(parsed.models) || typeof parsed.fetchedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(models: Model[], fetchedAt: number): void {
  if (!browser) return;
  try {
    const payload: CacheShape = { models, fetchedAt };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / disabled — ignore */
  }
}

/** Hydrate from cache synchronously on first access so the picker isn't empty. */
function hydrateFromCacheOnce(): void {
  if (status !== 'idle') return;
  const cached = loadCache();
  if (cached) {
    items = cached.models;
    fetchedAt = cached.fetchedAt;
    status = 'ready';
  }
}

/**
 * Refresh the model list. `force=false` respects the TTL; `force=true`
 * always hits the network.
 */
export async function refreshModels(force = false): Promise<void> {
  if (!browser) return;

  // Respect TTL unless forced
  if (!force && fetchedAt && Date.now() - fetchedAt < CACHE_TTL_MS && items.length > 0) {
    return;
  }

  if (abortController) abortController.abort();
  abortController = new AbortController();
  status = 'loading';
  error = '';

  try {
    const result = await fetchModelsApi(abortController.signal);
    items = result.models;
    fetchedAt = result.fetchedAt;
    status = 'ready';
    saveCache(result.models, result.fetchedAt);
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    if (err instanceof OpenRouterError) {
      error = err.message;
    } else if (err instanceof Error) {
      error = err.message;
    } else {
      error = 'Unknown error fetching model catalog.';
    }
    status = 'error';
  } finally {
    abortController = null;
  }
}

/**
 * Public reactive surface. UI components read these properties inside
 * $derived / templates and auto-update.
 */
export const models = {
  /** Current status: 'idle' | 'loading' | 'ready' | 'error' */
  get status(): Status { return status; },
  /** Last error message (only valid when status === 'error') */
  get error(): string { return error; },
  /** Live models if available, else FALLBACK_MODELS. Always non-empty. */
  get list(): ReadonlyArray<Model> {
    if (items.length > 0) return items;
    return FALLBACK_MODELS;
  },
  /** True when we have a non-fallback, fetched list. */
  get isLive(): boolean {
    return status === 'ready' && items.length > 0;
  },
  /** Unix ms timestamp of the last successful fetch, or null. */
  get fetchedAt(): number | null { return fetchedAt; },
  /** Trigger a refresh. */
  refresh(force = true): Promise<void> { return refreshModels(force); },
  /** Resolve a Model by id (live list first, fallback otherwise). */
  find(id: string): Model | undefined {
    return (items.length > 0 ? items : Array.from(FALLBACK_MODELS)).find((m) => m.id === id);
  },
  /** Group models by provider → { [provider]: Model[] }. */
  get byProvider(): Record<string, Model[]> {
    const list = items.length > 0 ? items : Array.from(FALLBACK_MODELS);
    const out: Record<string, Model[]> = {};
    for (const m of list) (out[m.provider] ||= []).push(m);
    return out;
  }
};

/**
 * One-time initialization. Hydrate from cache immediately, then schedule a
 * background refresh if the cache is stale or we have a key and no data.
 *
 * Also installs a $effect that watches the API key. When the key flips from
 * empty → set (user saves in Settings), we refresh so the authenticated
 * availability view is accurate.
 */
export function initModelsStore(): void {
  if (!browser) return;
  hydrateFromCacheOnce();

  // Kick an initial refresh on idle — don't block UI.
  const maybeStaleOrEmpty =
    status === 'idle' || (fetchedAt !== null && Date.now() - fetchedAt > CACHE_TTL_MS);
  if (maybeStaleOrEmpty) {
    // If no key yet, still fetch — /models works unauthenticated too.
    queueMicrotask(() => { refreshModels(false); });
  }

  // Track API key changes for a key-aware refresh.
  $effect.root(() => {
    let lastKey = getApiKey();
    $effect(() => {
      const current = getApiKey();
      if (current !== lastKey) {
        lastKey = current;
        // Force refresh so the authenticated view reflects the new key
        refreshModels(true);
      }
    });
  });
}
