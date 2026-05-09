import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  plugins: [sveltekit(), svelteTesting()],
  // Expose both VITE_* and PUBLIC_* env vars to client code via
  // `import.meta.env`. Default Vite envPrefix is `VITE_` only; without this
  // override, every `import.meta.env.PUBLIC_*` reference resolves to
  // undefined at build time even when the value is present in the process env.
  envPrefix: ['VITE_', 'PUBLIC_'],
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
  optimizeDeps: {
    include: [
      // IDs
      'ulid',
      // AI / provider packages
      'ai',
      '@openrouter/ai-sdk-provider',
      '@ai-sdk/anthropic',
      '@ai-sdk/openai-compatible',
      // UI utilities
      'clsx',
      'tailwind-merge',
      // gpt-tokenizer encodings (lazily imported but pre-bundled to avoid reload)
      'gpt-tokenizer/encoding/o200k_base',
      'gpt-tokenizer/encoding/cl100k_base',
      'gpt-tokenizer/encoding/p50k_edit',
      'gpt-tokenizer/encoding/r50k_base',
      // lucide-svelte icons (all icons used across the app)
      'lucide-svelte/icons/activity',
      'lucide-svelte/icons/arrow-left',
      'lucide-svelte/icons/arrow-left-right',
      'lucide-svelte/icons/arrow-right',
      'lucide-svelte/icons/arrow-up',
      'lucide-svelte/icons/bomb',
      'lucide-svelte/icons/book-open',
      'lucide-svelte/icons/brain',
      'lucide-svelte/icons/braces',
      'lucide-svelte/icons/check',
      'lucide-svelte/icons/chevron-down',
      'lucide-svelte/icons/chevron-right',
      'lucide-svelte/icons/circle-check',
      'lucide-svelte/icons/circle-help',
      'lucide-svelte/icons/circle-x',
      'lucide-svelte/icons/clock',
      'lucide-svelte/icons/copy',
      'lucide-svelte/icons/download',
      'lucide-svelte/icons/external-link',
      'lucide-svelte/icons/eye',
      'lucide-svelte/icons/eye-off',
      'lucide-svelte/icons/file',
      'lucide-svelte/icons/paperclip',
      'lucide-svelte/icons/flask-conical',
      'lucide-svelte/icons/gift',
      'lucide-svelte/icons/github',
      'lucide-svelte/icons/grip-vertical',
      'lucide-svelte/icons/hash',
      'lucide-svelte/icons/history',
      'lucide-svelte/icons/info',
      'lucide-svelte/icons/key',
      'lucide-svelte/icons/languages',
      'lucide-svelte/icons/loader-circle',
      'lucide-svelte/icons/message-square',
      'lucide-svelte/icons/monitor',
      'lucide-svelte/icons/moon',
      'lucide-svelte/icons/plus',
      'lucide-svelte/icons/refresh-cw',
      'lucide-svelte/icons/rotate-ccw',
      'lucide-svelte/icons/scan-search',
      'lucide-svelte/icons/scissors',
      'lucide-svelte/icons/search',
      'lucide-svelte/icons/settings',
      'lucide-svelte/icons/shield',
      'lucide-svelte/icons/shuffle',
      'lucide-svelte/icons/smile',
      'lucide-svelte/icons/sparkles',
      'lucide-svelte/icons/split',
      'lucide-svelte/icons/star',
      'lucide-svelte/icons/sun',
      'lucide-svelte/icons/pencil',
      'lucide-svelte/icons/trash-2',
      'lucide-svelte/icons/triangle-alert',
      'lucide-svelte/icons/wand-sparkles',
      'lucide-svelte/icons/wrench',
      'lucide-svelte/icons/x',
      'lucide-svelte/icons/zap',
      'lucide-svelte/icons/git-branch',
      'lucide-svelte/icons/square',
      'lucide-svelte/icons/user',
    ]
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    setupFiles: ['src/setupTests.ts'],
    // Single-fork execution keeps test-file isolation simple and
    // avoids shared module-scope state between parallel workers.
    pool: 'forks',
    fileParallelism: false
  }
});
