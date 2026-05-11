/**
 * Per-tool reactive Vault store.
 *
 * Vault items split into two layers:
 *  - `bundledSeeds`: shipped immutable items (loaded from JSON via Vite-glob).
 *  - User-added items: persisted to localStorage under `cryptex.vault.<toolId>`.
 *
 * The store exposes search / add / edit / remove / togglePin / allTags so any
 * tool can drive a <VaultSection> drawer without duplicating the same plumbing.
 *
 * Persistence is synchronous on mutation; tests can assert on the storage key
 * immediately after add()/edit()/remove() without waiting for an effect flush.
 */
import { browser } from '$app/environment';
import type { VaultItem, VaultQuery } from './types';
import { Errors, isCryptexError } from '$lib/errors/types';
import { errorLogger } from '$lib/errors/logger';

const STORAGE_KEY_PREFIX = 'cryptex.vault.';

function storageKey(toolId: string): string {
  return `${STORAGE_KEY_PREFIX}${toolId}`;
}

function pinSetKey(toolId: string): string {
  return `${storageKey(toolId)}.pinned`;
}

function loadUserItems<T>(toolId: string): VaultItem<T>[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(storageKey(toolId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VaultItem<T>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((it): it is VaultItem<T> => {
      if (typeof it !== 'object' || it === null) return false;
      const o = it as unknown as Record<string, unknown>;
      return (
        typeof o.id === 'string' &&
        o.schemaVersion === 1 &&
        typeof o.title === 'string' &&
        Array.isArray(o.tags)
      );
    });
  } catch (err) {
    errorLogger.report(err, { toast: false, session: false });
    return [];
  }
}

function saveUserItems<T>(toolId: string, items: VaultItem<T>[]): void {
  if (!browser) return;
  try {
    localStorage.setItem(storageKey(toolId), JSON.stringify(items));
  } catch (err) {
    errorLogger.report(
      isCryptexError(err) ? err : Errors.storageQuota('Cannot save Vault — storage full.', err)
    );
  }
}

function loadPinnedBundled(toolId: string): Set<string> {
  if (!browser) return new Set();
  try {
    const raw = localStorage.getItem(pinSetKey(toolId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function savePinnedBundled(toolId: string, set: Set<string>): void {
  if (!browser) return;
  try {
    localStorage.setItem(pinSetKey(toolId), JSON.stringify([...set]));
  } catch {
    /* quota — silently drop */
  }
}

function genId(): string {
  return `v_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export interface VaultStore<TPayload> {
  /** All items (bundled + user), reactive. */
  readonly items: VaultItem<TPayload>[];
  /** Apply a query and return matches. */
  search(q: VaultQuery): VaultItem<TPayload>[];
  /** Add a new user item. Returns the new item (with generated id + timestamps). */
  add(init: Omit<VaultItem<TPayload>, 'id' | 'schemaVersion' | 'source' | 'addedAt'>): VaultItem<TPayload>;
  /** Remove a user item by id. Bundled items can't be removed. Returns true if removed. */
  remove(id: string): boolean;
  /** Edit a user item. Bundled items can't be edited. Returns true if edited. */
  edit(
    id: string,
    patch: Partial<Pick<VaultItem<TPayload>, 'title' | 'description' | 'tags' | 'payload' | 'notes' | 'pinned'>>
  ): boolean;
  /** Toggle pinned flag. Works on both bundled (side-table) and user items. */
  togglePin(id: string): void;
  /** All unique tags across items (for filter UI). */
  allTags(): string[];
  /** Counts — useful for badges. */
  count(): { total: number; bundled: number; user: number };
}

export function createVaultStore<TPayload>(
  toolId: string,
  bundledSeeds: readonly VaultItem<TPayload>[]
): VaultStore<TPayload> {
  // Validate bundled at module load (defensive — bundled JSON should be correct but assert)
  for (const s of bundledSeeds) {
    if (s.source !== 'bundled') {
      errorLogger.report(
        Errors.tool(`Bundled vault seed for ${toolId} missing 'bundled' source: ${s.id}`),
        { toast: false }
      );
    }
  }

  // Reactive user items + reactive pin-set for bundled items.
  const _user = $state<VaultItem<TPayload>[]>(loadUserItems<TPayload>(toolId));
  let _bundledPins = $state<Set<string>>(loadPinnedBundled(toolId));

  const items = $derived.by<VaultItem<TPayload>[]>(() => {
    // Layer the bundled-pinned side-table into the read view so togglePin on
    // a bundled item updates its `pinned` flag in the items list reactively.
    const bundledView = bundledSeeds.map((b) =>
      _bundledPins.has(b.id) ? { ...b, pinned: true } : b
    );
    return [...bundledView, ..._user];
  });

  function persistUser(): void {
    saveUserItems(toolId, _user);
  }

  function persistBundledPins(): void {
    savePinnedBundled(toolId, _bundledPins);
  }

  function matchesQuery(it: VaultItem<TPayload>, q: VaultQuery): boolean {
    if (q.source && it.source !== q.source) return false;
    if (q.pinnedOnly && !it.pinned) return false;
    if (q.tags && q.tags.length > 0) {
      for (const t of q.tags) if (!it.tags.includes(t)) return false;
    }
    if (q.text) {
      const needle = q.text.toLowerCase();
      const hay = [it.title, it.description ?? '', ...it.tags].join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  }

  return {
    get items() {
      return items;
    },
    search(q) {
      return items.filter((it) => matchesQuery(it, q));
    },
    add(init) {
      const item: VaultItem<TPayload> = {
        ...init,
        id: genId(),
        schemaVersion: 1,
        source: 'user',
        addedAt: Date.now()
      };
      _user.push(item);
      persistUser();
      return item;
    },
    remove(id) {
      const idx = _user.findIndex((x) => x.id === id);
      if (idx < 0) return false;
      _user.splice(idx, 1);
      persistUser();
      return true;
    },
    edit(id, patch) {
      const idx = _user.findIndex((x) => x.id === id);
      if (idx < 0) return false;
      const cur = _user[idx];
      _user[idx] = { ...cur, ...patch };
      persistUser();
      return true;
    },
    togglePin(id) {
      const userIdx = _user.findIndex((x) => x.id === id);
      if (userIdx >= 0) {
        const cur = _user[userIdx];
        _user[userIdx] = { ...cur, pinned: !cur.pinned };
        persistUser();
        return;
      }
      // Bundled — toggle in pin-set
      const next = new Set(_bundledPins);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      _bundledPins = next;
      persistBundledPins();
    },
    allTags() {
      const set = new Set<string>();
      for (const it of items) for (const t of it.tags) set.add(t);
      return [...set].sort();
    },
    count() {
      return {
        total: items.length,
        bundled: bundledSeeds.length,
        user: _user.length
      };
    }
  };
}
