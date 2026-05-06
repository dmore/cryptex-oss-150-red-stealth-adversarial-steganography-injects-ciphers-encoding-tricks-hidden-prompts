import { describe, it, expect } from 'vitest';
import { allTechniques, listAll, search } from '../registry';

describe('registry search', () => {
  it('listAll is an alias of allTechniques', () => {
    expect(listAll).toBe(allTechniques);
    expect(listAll().length).toBe(allTechniques().length);
  });

  it('empty query returns all techniques', () => {
    expect(search('').length).toBe(allTechniques().length);
    expect(search('   ').length).toBe(allTechniques().length);
  });

  it('substring match against name works', () => {
    const hits = search('rephrase');
    expect(hits.some((t) => t.id === 'rephrase')).toBe(true);
  });

  it('search is case-insensitive', () => {
    const a = search('RePhRaSe');
    const b = search('rephrase');
    expect(a.length).toBe(b.length);
    expect(a.some((t) => t.id === 'rephrase')).toBe(true);
  });

  it('matches across name / description / category / id', () => {
    // Matches by category
    expect(search('mutate').some((t) => t.category === 'mutate')).toBe(true);
    // Matches by id
    expect(search('many_shot').some((t) => t.id === 'many_shot')).toBe(true);
    // Matches by description word — "academic" appears in at least one description
    expect(search('academic').length).toBeGreaterThan(0);
  });
});
