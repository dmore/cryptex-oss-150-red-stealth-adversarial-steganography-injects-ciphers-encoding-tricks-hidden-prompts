import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';

const BASE_PATH = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.svx', '.md'],
  preprocess: [
    vitePreprocess(),
    mdsvex({
      extensions: ['.svx', '.md'],
      smartypants: { quotes: true, ellipses: true, dashes: 'oldschool' }
    })
  ],
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      // GitHub Pages serves 404.html (NOT index.html) for any path it can't
      // resolve. Using 404.html as the SPA fallback means deep-links and
      // no-trailing-slash URLs (e.g. /cryptex-oss/emoji) fall through to the
      // app shell and the client router resolves them, instead of hitting
      // GitHub's own 404 page.
      fallback: '404.html',
      precompress: false,
      strict: false
    }),
    paths: {
      base: BASE_PATH
    },
    // Deploy version-skew handling. SvelteKit's default version.name is a
    // unique per-build hash, so _app/version.json changes every deploy.
    // Polling flips the `updated` store when a new deploy is detected; the
    // root layout's beforeNavigate then forces a full-page navigation so a
    // stale client never attempts a dead (renamed) chunk import. Combined
    // with the vite:preloadError reload in hooks.client.ts, this fixes the
    // intermittent "tool stuck after a deploy, reload fixes it" bug.
    version: {
      pollInterval: 60_000
    },
    alias: {
      $transformers: '../src/transformers'
    }
  }
};

export default config;
