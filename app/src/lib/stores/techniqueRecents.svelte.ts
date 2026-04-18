import { createPersistedState } from './_persisted.svelte';

export const techniqueRecents = createPersistedState<string[]>('cryptex.ui.techniqueRecents', []);

export function pushRecent(id: string, max = 5): void {
  const current = techniqueRecents.value ?? [];
  techniqueRecents.value = [id, ...current.filter((x) => x !== id)].slice(0, max);
}
