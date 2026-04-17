import { browser } from '$app/environment';
import { createPersistedState } from './_persisted.svelte';

export type ThemeMode = 'light' | 'dark' | 'system';

const persisted = createPersistedState<{ mode: ThemeMode }>('cryptex.theme', { mode: 'system' });

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (!browser) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = {
  get mode() { return persisted.value.mode; },
  get resolved() { return resolve(persisted.value.mode); },

  set(mode: ThemeMode) {
    persisted.value = { mode };
    apply();
  },

  cycle() {
    const next: ThemeMode = this.mode === 'light' ? 'dark' : this.mode === 'dark' ? 'system' : 'light';
    this.set(next);
  }
};

export function apply(): void {
  if (!browser) return;
  const resolved = resolve(persisted.value.mode);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function watchSystemTheme(): () => void {
  if (!browser) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => { if (persisted.value.mode === 'system') apply(); };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
