import { session } from '$lib/auth/session.svelte';

export const entitlement = {
  get isPaid(): boolean {
    const p = session.current?.plan;
    return p === 'paid' || p === 'grace';
  },
  get isSignedIn(): boolean {
    return session.isSignedIn;
  }
};

/** Call before triggering a paid-only feature. Returns true if allowed;
 *  returns false AND dispatches billing:show-upgrade event if not.
 *  UX only — the real authz lives in the godmode-prompt Edge Function. */
export function requirePaid(feature: string): boolean {
  if (entitlement.isPaid) return true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('billing:show-upgrade', { detail: { feature } }));
  }
  return false;
}
