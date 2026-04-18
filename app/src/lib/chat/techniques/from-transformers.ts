import { allTransformers } from '$lib/transformers/registry';
import type { Technique } from './types';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

let _cached: Technique[] | null = null;

export function transformerTechniques(): Technique[] {
  if (_cached) return _cached;
  _cached = allTransformers.map((t) => ({
    id: slugify(t.name),
    name: t.name,
    description: t.description ?? t.name,
    category: 'transform' as const,
    local: true,
    apply: async (input: string) => {
      try {
        const output = typeof t.func === 'function' ? t.func(input) : String(t.func);
        return { output: typeof output === 'string' ? output : JSON.stringify(output) };
      } catch (err) {
        return { output: '', metadata: { error: (err as Error).message } };
      }
    }
  }));
  return _cached;
}
