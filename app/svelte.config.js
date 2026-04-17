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
      fallback: 'index.html',
      precompress: false,
      strict: false
    }),
    paths: {
      base: BASE_PATH
    },
    alias: {
      $transformers: '../src/transformers',
      $legacy: '../js'
    }
  }
};

export default config;
