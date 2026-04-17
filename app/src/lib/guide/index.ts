// Guide content loader. Uses Vite's import.meta.glob to discover every
// markdown module under src/lib/guide/**/*.md at build time. Each module is
// processed by mdsvex (registered in svelte.config.js) and exposes a default
// Svelte component plus a `metadata` object parsed from frontmatter.

import type { Component } from 'svelte';

export type GuideCategory = 'intro' | 'tools' | 'recipes' | 'policy';

export interface GuideMeta {
  title: string;
  description: string;
  category: GuideCategory;
  order: number;
}

export interface GuideEntry {
  slug: string;
  path: string;
  meta: GuideMeta;
  component: Component;
}

interface GuideModule {
  default: Component;
  metadata: GuideMeta;
}

const modules = import.meta.glob<GuideModule>('./**/*.md', { eager: true });

function slugFrom(path: string): string {
  // './tools/transform.md' -> 'transform'
  // './intro.md'           -> 'intro'
  const file = path.replace(/^\.\//, '').replace(/\.md$/, '');
  const segments = file.split('/');
  return segments[segments.length - 1];
}

const rawEntries: GuideEntry[] = Object.entries(modules).map(([path, mod]) => ({
  slug: slugFrom(path),
  path,
  meta: mod.metadata,
  component: mod.default
}));

// Category display order for the sidebar.
export const categoryOrder: GuideCategory[] = ['intro', 'tools', 'recipes', 'policy'];

export const categoryLabels: Record<GuideCategory, string> = {
  intro: 'Introduction',
  tools: 'Tools',
  recipes: 'Recipes',
  policy: 'Policy'
};

export const guideEntries: GuideEntry[] = rawEntries
  .filter((entry) => entry.meta && entry.meta.category)
  .sort((a, b) => {
    const catDiff =
      categoryOrder.indexOf(a.meta.category) - categoryOrder.indexOf(b.meta.category);
    if (catDiff !== 0) return catDiff;
    return (a.meta.order ?? 99) - (b.meta.order ?? 99);
  });

export const guideBySlug: Record<string, GuideEntry> = Object.fromEntries(
  guideEntries.map((entry) => [entry.slug, entry])
);

export function guideByCategory(): Array<{
  category: GuideCategory;
  label: string;
  entries: GuideEntry[];
}> {
  return categoryOrder
    .map((category) => ({
      category,
      label: categoryLabels[category],
      entries: guideEntries.filter((entry) => entry.meta.category === category)
    }))
    .filter((group) => group.entries.length > 0);
}
