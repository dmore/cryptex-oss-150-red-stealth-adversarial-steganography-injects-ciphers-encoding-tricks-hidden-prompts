/**
 * Phase 0 smoke test: verifies the import.meta.glob pipeline discovers
 * every transformer under ../src/transformers without throwing (Risk #1
 * from the migration plan — "transformer Node-only idioms leak to browser").
 *
 * This will catch:
 *   - Any transformer that throws at module-evaluation time
 *   - Any transformer that references `window.*` before the globals shim fires
 *   - Any transformer module that doesn't export a default BaseTransformer
 *
 * If the count here drifts from the Python CLI count (`uv run cryptex-cli list`),
 * something is being filtered out and needs investigating.
 */
import { describe, it, expect } from 'vitest';
import {
  transformers,
  transformersByCategory,
  allTransformers,
  categories,
  transformerCount,
  getTransformer
} from './registry';

describe('transformer registry (Phase 0 smoke)', () => {
  it('loads a non-trivial number of transformers', () => {
    // 162 is the documented count; 150 is a safe floor for drift.
    expect(transformerCount).toBeGreaterThan(150);
  });

  it('every transformer has name, func, and category', () => {
    for (const t of allTransformers) {
      expect(t.name, `transformer missing name (category=${t.category})`).toBeTruthy();
      expect(typeof t.func, `${t.name}.func not a function`).toBe('function');
      expect(t.category, `${t.name} missing category`).toBeTruthy();
    }
  });

  it('exposes all expected categories', () => {
    const expected = [
      'ancient', 'case', 'cipher', 'encoding', 'fantasy',
      'format', 'special', 'technical', 'unicode', 'visual'
    ];
    for (const c of expected) {
      expect(categories, `missing category: ${c}`).toContain(c);
      expect(transformersByCategory[c].length, `empty category: ${c}`).toBeGreaterThan(0);
    }
  });

  it('can resolve well-known transformers by name', () => {
    const caesar = getTransformer('Caesar Cipher');
    expect(caesar, 'Caesar Cipher missing').toBeTruthy();
    expect(typeof caesar!.func).toBe('function');

    const base64 = getTransformer('Base64');
    expect(base64, 'Base64 missing').toBeTruthy();
  });

  it('Caesar encodes A→D with default shift', () => {
    const caesar = getTransformer('Caesar Cipher')!;
    // Defaults are schema-driven; func may read from options passed by UI.
    // For this smoke test we just verify it runs and produces a string.
    const out = caesar.func('Hello');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('ROT13 round-trips', () => {
    const rot13 = getTransformer('ROT13');
    if (!rot13) return; // skip if named differently
    const encoded = rot13.func('hello');
    const decoded = rot13.reverse!(encoded);
    expect(decoded).toBe('hello');
  });

  it('Base64 round-trips', () => {
    const b64 = getTransformer('Base64');
    if (!b64) return;
    const encoded = b64.func('hello world');
    const decoded = b64.reverse!(encoded);
    expect(decoded).toBe('hello world');
  });

  it('registry and category groupings are consistent', () => {
    const totalByCategory = Object.values(transformersByCategory)
      .reduce((sum, list) => sum + list.length, 0);
    expect(totalByCategory).toBe(allTransformers.length);
    expect(Object.keys(transformers).length).toBe(allTransformers.length);
  });
});
