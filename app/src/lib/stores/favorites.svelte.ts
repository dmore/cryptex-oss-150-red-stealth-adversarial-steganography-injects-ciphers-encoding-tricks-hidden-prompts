/**
 * Set of transformer display-names the user has pinned. Persisted to
 * `cryptex.transformFavorites` as a JSON array.
 */
import { createPersistedState } from './_persisted.svelte';

const persisted = createPersistedState<string[]>('cryptex.transformFavorites', []);

export const favorites = {
  get items(): ReadonlyArray<string> {
    return persisted.value;
  },

  has(name: string): boolean {
    return persisted.value.includes(name);
  },

  toggle(name: string): void {
    const set = new Set(persisted.value);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    persisted.value = [...set];
  },

  add(name: string): void {
    if (!persisted.value.includes(name)) {
      persisted.value = [...persisted.value, name];
    }
  },

  remove(name: string): void {
    persisted.value = persisted.value.filter((n) => n !== name);
  }
};
