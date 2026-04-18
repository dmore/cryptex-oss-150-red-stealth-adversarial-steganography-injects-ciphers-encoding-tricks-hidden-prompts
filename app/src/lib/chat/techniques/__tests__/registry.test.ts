import { describe, it, expect } from 'vitest';
import { allTechniques, byCategory, find, search } from '../registry';

describe('technique registry', () => {
  it('contains transformers (category=transform) from $lib/transformers/registry', () => {
    const t = byCategory('transform');
    expect(t.length).toBeGreaterThan(100); // we expect 162 but registry may filter
  });

  it('contains exactly the 9 PromptCraft mutators', () => {
    const m = byCategory('mutate');
    expect(m.map(x => x.id).sort()).toEqual(
      ['compress', 'custom', 'expand', 'fragment', 'metaphor', 'multilingual', 'obfuscate', 'rephrase', 'roleplay'].sort()
    );
  });

  it('contains exactly the 9 Anti-Classifier techniques', () => {
    const c = byCategory('classifier');
    expect(c.length).toBe(9);
  });

  it('contains the 3 modes', () => {
    const modes = byCategory('mode');
    expect(modes.map(x => x.id).sort()).toEqual(['adaptive', 'creative', 'intelligent']);
    for (const mode of modes) {
      expect(mode.wrapDraft).toBeTypeOf('function');
      expect(mode.local).toBe(true);
    }
  });

  it('contains at least one godmode stub', () => {
    const g = byCategory('godmode');
    expect(g.length).toBeGreaterThanOrEqual(1);
    expect(g[0].jailbreakSequence).toBeTypeOf('function');
  });

  it('find returns by id', () => {
    expect(find('rephrase')?.id).toBe('rephrase');
    expect(find('nonexistent')).toBeUndefined();
  });

  it('search is fuzzy across name/description/category', () => {
    expect(search('base').length).toBeGreaterThan(0);
    expect(search('creative').some(x => x.id === 'creative')).toBe(true);
  });

  it('all transform techniques have local=true', () => {
    const t = byCategory('transform');
    expect(t.every(x => x.local === true)).toBe(true);
  });

  it('all mutate techniques have local=false', () => {
    const m = byCategory('mutate');
    expect(m.every(x => x.local === false)).toBe(true);
  });

  it('all classifier techniques have local=false', () => {
    const c = byCategory('classifier');
    expect(c.every(x => x.local === false)).toBe(true);
  });

  it('allTechniques total is >= 180 (transformers + 9 mutators + 9 classifier + 3 modes + 1 godmode)', () => {
    // transformer count is ~159-162 depending on env; test just verifies sum is plausible
    expect(allTechniques().length).toBeGreaterThanOrEqual(180);
  });
});
