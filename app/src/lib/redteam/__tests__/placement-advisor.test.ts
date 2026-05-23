import { describe, it, expect } from 'vitest';
import {
  advisePlacement,
  kindFromIndirectKind,
  type DocKind,
  type Placement
} from '../placement-advisor';

describe('placement-advisor', () => {
  it('returns advice for a known (webpage, body) combo with high score', () => {
    const advice = advisePlacement('webpage', 'body');
    expect(advice.successHeuristic).toBeGreaterThan(0.7);
    expect(advice.rationale.length).toBeGreaterThan(10);
  });

  it('returns advice for (webpage, comment) — comments are stripped (mid score)', () => {
    const advice = advisePlacement('webpage', 'comment');
    expect(advice.successHeuristic).toBeLessThanOrEqual(0.7);
    expect(advice.rationale).toMatch(/comment|strip/i);
    expect(advice.recommendedDefense).toBeDefined();
  });

  it('returns advice for (pdf, metadata) — extractor-dependent', () => {
    const advice = advisePlacement('pdf', 'metadata');
    expect(advice.successHeuristic).toBeGreaterThan(0);
    expect(advice.successHeuristic).toBeLessThan(1);
    expect(advice.rationale).toMatch(/parser|extract|metadata/i);
  });

  it('returns advice for (image-alt, body) — caption pathway is strong', () => {
    const advice = advisePlacement('image-alt', 'body');
    expect(advice.successHeuristic).toBeGreaterThan(0.5);
  });

  it('falls back to default for unknown (kind, placement) combo', () => {
    // image-alt + footer is not in the table — should hit fallback
    const advice = advisePlacement('image-alt' as DocKind, 'footer' as Placement);
    expect(advice.successHeuristic).toBe(0.5);
    expect(advice.rationale).toMatch(/no specific|moderate/i);
  });

  it('returns numeric heuristic for every (kind, placement) pair', () => {
    const kinds: DocKind[] = [
      'doc', 'webpage', 'email', 'image-alt', 'rss', 'code',
      'pdf', 'github-readme', 'changelog', 'json-config', 'wiki', 'forum'
    ];
    const placements: Placement[] = ['header', 'body', 'footer', 'comment', 'metadata'];
    for (const k of kinds) {
      for (const p of placements) {
        const advice = advisePlacement(k, p);
        expect(typeof advice.successHeuristic).toBe('number');
        expect(advice.successHeuristic).toBeGreaterThanOrEqual(0);
        expect(advice.successHeuristic).toBeLessThanOrEqual(1);
        expect(advice.rationale).toBeTypeOf('string');
        expect(advice.rationale.length).toBeGreaterThan(0);
      }
    }
  });

  it('advice contains rationale text on common combos', () => {
    const advice = advisePlacement('email', 'body');
    expect(advice.rationale).toMatch(/body|email|context|triage|summar/i);
  });
});

describe('kindFromIndirectKind', () => {
  it('maps known indirect-injection kinds to advisor DocKinds', () => {
    expect(kindFromIndirectKind('web-article')).toBe('webpage');
    expect(kindFromIndirectKind('wiki-page')).toBe('wiki');
    expect(kindFromIndirectKind('email-thread')).toBe('email');
    expect(kindFromIndirectKind('code-comment')).toBe('code');
    expect(kindFromIndirectKind('rss-feed')).toBe('rss');
    expect(kindFromIndirectKind('pdf-text')).toBe('pdf');
    expect(kindFromIndirectKind('forum-post')).toBe('forum');
    expect(kindFromIndirectKind('github-readme')).toBe('github-readme');
    expect(kindFromIndirectKind('changelog')).toBe('changelog');
    expect(kindFromIndirectKind('json-config')).toBe('json-config');
  });

  it('falls back to doc for unknown kind', () => {
    expect(kindFromIndirectKind('mystery-format')).toBe('doc');
    expect(kindFromIndirectKind('')).toBe('doc');
  });
});
