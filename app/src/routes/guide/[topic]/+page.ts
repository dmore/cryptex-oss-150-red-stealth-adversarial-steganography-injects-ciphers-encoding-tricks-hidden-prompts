import { guideEntries } from '$lib/guide';

export const prerender = true;
export const ssr = false;

// Enumerate all topic slugs for prerender.
export function entries() {
  return guideEntries.map((entry) => ({ topic: entry.slug }));
}
