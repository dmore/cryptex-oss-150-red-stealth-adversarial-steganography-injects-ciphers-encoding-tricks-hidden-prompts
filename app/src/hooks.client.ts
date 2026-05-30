/**
 * Client hooks.
 *
 * PRIMARY FIX for the intermittent "tool stuck / lists don't load, reload
 * fixes it" bug on GitHub Pages.
 *
 * Cryptex is a pure client-rendered SPA (`ssr = false`, `prerender = true`)
 * served from GitHub Pages, redeployed frequently. Every deploy rehashes the
 * lazily-imported route/chunk filenames and the old ones vanish from the CDN.
 * A browser holding a stale app shell then tries to `import()` a chunk whose
 * hashed filename no longer exists -> 404 -> the route never mounts -> the
 * tool area stays blank -> the user reloads -> fresh shell -> works.
 *
 * Vite fires a `vite:preloadError` window event the instant such a lazy
 * import fails. We catch it and do a ONE-TIME full reload (guarded by a
 * sessionStorage flag so a genuinely-broken chunk can't cause a reload loop).
 * The reload pulls the fresh shell + fresh chunk names, so the tool loads —
 * the user just sees a brief refresh instead of a permanently stuck tool.
 */
import type { HandleClientError } from '@sveltejs/kit';

const RELOAD_FLAG = 'cryptex.reloadedForChunk';

if (typeof window !== 'undefined') {
  // A successful load means we are NOT in a reload loop — clear the guard so
  // a future genuine version-skew can reload again.
  window.addEventListener('load', () => {
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* storage disabled — ignore */
    }
  });

  // Vite's preload-error event: a dynamically imported chunk failed to load
  // (classic stale-deploy 404). Reload once to get the fresh shell.
  window.addEventListener('vite:preloadError', (event) => {
    let alreadyReloaded = false;
    try {
      alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
    } catch {
      /* storage disabled */
    }
    if (alreadyReloaded) return; // don't loop on a truly-broken chunk

    // Prevent the default unhandled-rejection so the console stays clean.
    event.preventDefault?.();
    try {
      sessionStorage.setItem(RELOAD_FLAG, '1');
    } catch {
      /* storage disabled */
    }
    // Full reload onto the current URL → fresh index.html + fresh chunks.
    location.reload();
  });
}

/**
 * SvelteKit client error hook. Logs for observability so any OTHER failure
 * mode (not a chunk preload error) surfaces in the console instead of
 * hanging silently. Returns a minimal app-shaped error object.
 */
export const handleError: HandleClientError = ({ error, event }) => {
  if (typeof console !== 'undefined') {
    console.error('[cryptex] client error', { url: event?.url?.pathname, error });
  }
  return {
    message: 'Something went wrong loading this view. Try reloading the page.'
  };
};
