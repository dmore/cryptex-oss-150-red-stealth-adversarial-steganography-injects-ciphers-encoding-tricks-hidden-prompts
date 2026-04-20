import { describe, it, expect, vi } from 'vitest';

describe('entitlement', () => {
  it('isPaid is false by default (free plan)', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_AUTH_ENABLED', 'false');
    const { entitlement } = await import('../entitlement.svelte');
    expect(entitlement.isPaid).toBe(false);
    vi.unstubAllEnvs();
  });

  it('requirePaid dispatches show-upgrade event when not paid', async () => {
    const spy = vi.fn();
    window.addEventListener('billing:show-upgrade', spy);
    const { requirePaid } = await import('../entitlement.svelte');
    const ok = requirePaid('Godmode');
    expect(ok).toBe(false);
    expect(spy).toHaveBeenCalledOnce();
    window.removeEventListener('billing:show-upgrade', spy);
  });
});
