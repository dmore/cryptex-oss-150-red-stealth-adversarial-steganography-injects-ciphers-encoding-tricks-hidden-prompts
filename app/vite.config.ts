import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      $transformers: path.resolve(__dirname, '../src/transformers'),
      $legacy: path.resolve(__dirname, '../js')
    }
  },
  server: {
    fs: {
      // allow importing from outside the app/ project root (transformers live in ../src)
      allow: [path.resolve(__dirname, '..')]
    }
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
