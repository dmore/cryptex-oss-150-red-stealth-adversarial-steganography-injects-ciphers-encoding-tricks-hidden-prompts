/**
 * Single helper for reactive localStorage-backed stores using Svelte 5 runes.
 * Every persistent store in this project uses this — no one writes raw $effect + localStorage.
 */
import { browser } from '$app/environment';

export function createPersistedState<T>(key: string, initial: T) {
  let value = $state<T>(initial);

  if (browser) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) value = JSON.parse(raw) as T;
    } catch {
      /* corrupt entry — fall back to initial */
    }

    $effect.root(() => {
      $effect(() => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch {
          /* quota / disabled — silently drop */
        }
      });
    });
  }

  return {
    get value() { return value; },
    set value(next: T) { value = next; }
  };
}
