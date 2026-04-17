/**
 * Transformer registry — discovers every file under `../src/transformers/<category>/*.js`
 * via Vite's `import.meta.glob` and exposes a typed adapter over the legacy
 * BaseTransformer contract.
 *
 * Key design constraints (from the migration plan):
 *   1. NO transformer file is modified. Legacy files that reference
 *      `window.emojiData`, `window.transforms`, or `window.EmojiUtils` continue
 *      to work because `installTransformerGlobals()` runs before the glob.
 *   2. The Python CLI path (`scripts/cli_bridge.js` → `loader-node.js`) is
 *      independent of this module — it uses its own Node sandbox.
 *
 * Phase-0 status: scaffolded but not consumed by any UI route yet. Phase 1
 * wires this into the Transform + Decoder + Emoji tools.
 */

import { installTransformerGlobals, publishTransformerRegistry } from './_globals';

// Shape of an instantiated BaseTransformer (see src/transformers/BaseTransformer.js).
export type TransformerOption = {
  id: string;
  label: string;
  type: 'boolean' | 'select' | 'text' | 'number';
  default?: unknown;
  options?: Array<{ value: unknown; label: string }>;
  min?: number;
  max?: number;
  step?: number;
};

export type Transformer = {
  name: string;
  priority: number;
  canDecode: boolean;
  category?: string;
  description?: string;
  inputKind?: 'textarea' | 'text';
  configurableOptions?: TransformerOption[];
  map?: Record<string, string>;
  func: (text: string, options?: Record<string, unknown>) => string;
  reverse?: ((text: string, options?: Record<string, unknown>) => string) | null;
  preview?: (text: string, options?: Record<string, unknown>) => string;
  detector?: ((text: string) => boolean) | null;
};

// Install globals BEFORE the glob resolution happens. Critical.
installTransformerGlobals();

// Vite statically analyzes this path — every *.js under the transformers
// categories is eagerly imported at build time. Output: { "/path/to/file.js": module }
// See: https://vitejs.dev/guide/features.html#glob-import
// Path is relative to THIS file: app/src/lib/transformers/ → ../../../../src/transformers/
const modules = import.meta.glob<{ default: Transformer }>(
  '../../../../src/transformers/*/*.js',
  { eager: true }
);

// Derive registry keyed by transformer name. Category is inferred from the
// parent directory (ancient, case, cipher, encoding, fantasy, format,
// special, technical, unicode, visual) — matches the legacy contract.
const registry: Record<string, Transformer> = {};
const byCategory: Record<string, Transformer[]> = {};

for (const [path, mod] of Object.entries(modules)) {
  const transformer = mod.default as Transformer | undefined;
  if (!transformer || typeof transformer.func !== 'function') continue;

  // Extract category from the path: '../../../src/transformers/<category>/<file>.js'
  const parts = path.split('/');
  const category = parts[parts.length - 2];
  if (!transformer.category) transformer.category = category;

  registry[transformer.name] = transformer;
  (byCategory[category] ||= []).push(transformer);
}

// Publish to globalThis.transforms so `special/randomizer.js` can see peers.
publishTransformerRegistry(registry);

/** All transformers, keyed by display name. */
export const transformers: Readonly<Record<string, Transformer>> = Object.freeze(registry);

/** Transformers bucketed by category (ancient, case, cipher, ...). */
export const transformersByCategory: Readonly<Record<string, ReadonlyArray<Transformer>>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, Object.freeze([...v].sort(byName))])
    )
  );

/** Ordered list of all transformers, alphabetical by name. */
export const allTransformers: ReadonlyArray<Transformer> = Object.freeze(
  Object.values(registry).sort(byName)
);

/** Category list in stable order (matches the legacy `src/transformers/` directory listing). */
export const categories: ReadonlyArray<string> = Object.freeze(
  Object.keys(byCategory).sort()
);

/** Count — should be 162 once all are imported successfully. */
export const transformerCount = allTransformers.length;

function byName(a: Transformer, b: Transformer) {
  return a.name.localeCompare(b.name);
}

/** Resolve a transformer by display name (case-sensitive) or falsy if missing. */
export function getTransformer(name: string): Transformer | undefined {
  return registry[name];
}
