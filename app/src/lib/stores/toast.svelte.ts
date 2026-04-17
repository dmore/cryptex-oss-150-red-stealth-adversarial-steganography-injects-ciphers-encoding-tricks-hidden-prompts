/**
 * Lightweight toast/notification store. Replaces the Vue-era
 * `this.showNotification(message, kind)` pattern used across every legacy tool.
 */

export type ToastKind = 'info' | 'success' | 'error' | 'warn';
export type Toast = { id: number; message: string; kind: ToastKind; createdAt: number };

let nextId = 1;
let items = $state<Toast[]>([]);

export const toasts = {
  get items() { return items; },

  push(message: string, kind: ToastKind = 'info', ttlMs = 2600) {
    const id = nextId++;
    items = [...items, { id, message, kind, createdAt: Date.now() }];
    if (ttlMs > 0) {
      setTimeout(() => this.dismiss(id), ttlMs);
    }
    return id;
  },

  dismiss(id: number) {
    items = items.filter((t) => t.id !== id);
  },

  clear() { items = []; }
};

export const notify = {
  info: (m: string) => toasts.push(m, 'info'),
  success: (m: string) => toasts.push(m, 'success'),
  error: (m: string) => toasts.push(m, 'error', 4200),
  warn: (m: string) => toasts.push(m, 'warn', 3600)
};
