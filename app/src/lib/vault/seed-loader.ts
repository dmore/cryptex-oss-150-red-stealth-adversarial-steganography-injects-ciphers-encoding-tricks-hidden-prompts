import type { VaultItem } from './types';

/**
 * Load bundled vault seeds for a given tool. Seed files live under
 * app/src/lib/vault/seeds/<toolId>.json and are imported eagerly so they
 * ship in the static bundle.
 *
 * If no seed file exists for a tool, returns an empty array. Each item is
 * normalized: source forced to 'bundled', schemaVersion forced to 1, and
 * addedAt defaulted to 0 (treat bundled seeds as timeless).
 */
const seedModules = import.meta.glob('./seeds/*.json', { eager: true }) as Record<
  string,
  { default: VaultItem[] }
>;

export function loadBundledSeeds<T>(toolId: string): VaultItem<T>[] {
  const path = `./seeds/${toolId}.json`;
  const mod = seedModules[path];
  if (!mod) return [];
  return mod.default.map((it) => ({
    ...it,
    schemaVersion: 1 as const,
    source: 'bundled' as const,
    addedAt: it.addedAt ?? 0
  })) as VaultItem<T>[];
}
