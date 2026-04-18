import { browser } from '$app/environment';

// ── legacy model-picker bus ─────────────────────────────────────────────────
const listeners = new Set<() => void>();

export function onOpenModelPicker(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ── generic shortcut bus ────────────────────────────────────────────────────
type Handler = (e: KeyboardEvent) => void;
const shortcutHandlers = new Map<string, Set<Handler>>();

function keySpec(e: KeyboardEvent): string {
  const mods: string[] = [];
  if (e.ctrlKey || e.metaKey) mods.push('cmd');
  if (e.shiftKey) mods.push('shift');
  if (e.altKey) mods.push('alt');
  return [...mods, e.key.toLowerCase()].join('+');
}

if (browser) {
  window.addEventListener('keydown', (e) => {
    // ── legacy: Cmd+M opens model picker ─────────────────────────────────
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'm') {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        listeners.forEach((fn) => fn());
      }
    }

    // ── generic shortcut dispatch ─────────────────────────────────────────
    const spec = keySpec(e);
    const handlers = shortcutHandlers.get(spec);
    if (!handlers || handlers.size === 0) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      // Only a small allowlist passes through from input fields
      if (spec !== 'cmd+enter' && spec !== 'cmd+/' && spec !== 'escape') return;
    }
    e.preventDefault();
    handlers.forEach((fn) => fn(e));
  });
}

export function registerShortcut(spec: string, fn: Handler): () => void {
  let set = shortcutHandlers.get(spec);
  if (!set) { set = new Set(); shortcutHandlers.set(spec, set); }
  set.add(fn);
  return () => { set!.delete(fn); };
}
