import type { Technique, TechniqueCategory } from './types';
import { transformerTechniques } from './from-transformers';
import { mutatorTechniques } from './from-mutators';
import { classifierTechniques } from './from-classifier';
import { compositeTechniques } from './from-composites';
import { modes } from './modes';
import { godmodes } from './godmode';

let _all: Technique[] | null = null;

function build(): Technique[] {
  return [
    ...transformerTechniques(),
    ...mutatorTechniques(),
    ...classifierTechniques(),
    ...compositeTechniques(),
    ...modes,
    ...godmodes
  ];
}

export function allTechniques(): Technique[] {
  if (!_all) _all = build();
  return _all;
}

export function byCategory(cat: TechniqueCategory): Technique[] {
  return allTechniques().filter((t) => t.category === cat);
}

export function find(id: string): Technique | undefined {
  return allTechniques().find((t) => t.id === id);
}

export function search(query: string): Technique[] {
  const q = query.toLowerCase().trim();
  if (!q) return allTechniques();
  return allTechniques().filter((t) =>
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q)
  );
}
