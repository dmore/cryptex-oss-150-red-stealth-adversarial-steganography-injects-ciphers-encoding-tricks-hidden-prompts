/**
 * Bounded recent-transforms list. Stores name → timestamp (ms). Persisted
 * to `cryptex.transformLastUsed`. Used by the Transform tool to surface
 * a "Recently used" strip.
 */
import { createPersistedState } from './_persisted.svelte';

const MAX_RECENT = 10;
const persisted = createPersistedState<Record<string, number>>('cryptex.transformLastUsed', {});

export const lastUsed = {
  /** Records of {name: timestamp}, not sorted. */
  get records(): Readonly<Record<string, number>> {
    return persisted.value;
  },

  /** Names ordered most-recent first, capped at MAX_RECENT. */
  get ordered(): ReadonlyArray<string> {
    return Object.entries(persisted.value)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_RECENT)
      .map(([name]) => name);
  },

  touch(name: string): void {
    const next = { ...persisted.value, [name]: Date.now() };
    // Cap the map at 2x MAX_RECENT so it doesn't grow unbounded
    const entries = Object.entries(next).sort((a, b) => b[1] - a[1]);
    persisted.value = Object.fromEntries(entries.slice(0, MAX_RECENT * 2));
  },

  clear(): void {
    persisted.value = {};
  }
};
