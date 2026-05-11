import { describe, it, expect, beforeEach } from 'vitest';
import { createVaultStore } from '../store.svelte';
import type { VaultItem } from '../types';

type FooPayload = { prompt: string };

function makeBundled(id: string, title: string, tags: string[] = []): VaultItem<FooPayload> {
  return {
    id,
    schemaVersion: 1,
    title,
    description: `desc ${title}`,
    payload: { prompt: `payload-${id}` },
    tags,
    source: 'bundled',
    license: 'MIT',
    addedAt: 0
  };
}

const TOOL_ID = 'vault-test-tool';

beforeEach(() => {
  localStorage.clear();
});

describe('createVaultStore', () => {
  it('bundled seeds appear in items', () => {
    const seeds = [makeBundled('a', 'Alpha', ['x']), makeBundled('b', 'Beta', ['y'])];
    const store = createVaultStore<FooPayload>(TOOL_ID, seeds);
    expect(store.items.length).toBe(2);
    expect(store.items[0].id).toBe('a');
    expect(store.items[1].id).toBe('b');
    expect(store.count()).toEqual({ total: 2, bundled: 2, user: 0 });
  });

  it('add() generates id, sets source=user, addedAt, persists', () => {
    const store = createVaultStore<FooPayload>(TOOL_ID, []);
    const before = Date.now();
    const created = store.add({
      title: 'Custom one',
      tags: ['t1'],
      payload: { prompt: 'p' }
    });
    expect(created.id).toMatch(/^v_/);
    expect(created.schemaVersion).toBe(1);
    expect(created.source).toBe('user');
    expect(created.addedAt).toBeGreaterThanOrEqual(before);
    expect(created.title).toBe('Custom one');
    expect(store.items.length).toBe(1);

    const raw = localStorage.getItem(`cryptex.vault.${TOOL_ID}`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe(created.id);
  });

  it('remove() works for user items, returns false for bundled', () => {
    const seeds = [makeBundled('b1', 'Bundled1')];
    const store = createVaultStore<FooPayload>(TOOL_ID, seeds);
    const u = store.add({ title: 'User1', tags: [], payload: { prompt: 'x' } });
    expect(store.count().user).toBe(1);

    expect(store.remove('b1')).toBe(false); // bundled — cannot remove
    expect(store.count().bundled).toBe(1);

    expect(store.remove(u.id)).toBe(true);
    expect(store.count().user).toBe(0);
    expect(store.remove(u.id)).toBe(false); // already gone
  });

  it('edit() updates user item, returns false for bundled', () => {
    const seeds = [makeBundled('b1', 'Bundled1')];
    const store = createVaultStore<FooPayload>(TOOL_ID, seeds);
    const u = store.add({ title: 'Before', tags: [], payload: { prompt: 'x' } });

    expect(store.edit(u.id, { title: 'After', tags: ['new'] })).toBe(true);
    const found = store.items.find((x) => x.id === u.id)!;
    expect(found.title).toBe('After');
    expect(found.tags).toEqual(['new']);

    expect(store.edit('b1', { title: 'cant' })).toBe(false);
    expect(store.items.find((x) => x.id === 'b1')!.title).toBe('Bundled1');
  });

  it('search by text matches title/description/tags case-insensitively', () => {
    const seeds = [
      makeBundled('a', 'Foobar Title', ['foo']),
      makeBundled('b', 'Otherz', ['bar', 'foo']),
      makeBundled('c', 'NopeMatch', ['baz'])
    ];
    const store = createVaultStore<FooPayload>(TOOL_ID, seeds);
    // matches via title
    expect(store.search({ text: 'foobar' }).map((r) => r.id)).toEqual(['a']);
    // matches via description ("desc Otherz")
    expect(store.search({ text: 'desc otherz' }).map((r) => r.id)).toEqual(['b']);
    // matches via tag
    expect(store.search({ text: 'foo' }).map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('search by tag filters correctly (AND across tags)', () => {
    const seeds = [
      makeBundled('a', 'A', ['x', 'y']),
      makeBundled('b', 'B', ['y']),
      makeBundled('c', 'C', ['x', 'y', 'z'])
    ];
    const store = createVaultStore<FooPayload>(TOOL_ID, seeds);
    expect(store.search({ tags: ['x'] }).map((r) => r.id)).toEqual(['a', 'c']);
    expect(store.search({ tags: ['x', 'y'] }).map((r) => r.id)).toEqual(['a', 'c']);
    expect(store.search({ tags: ['x', 'y', 'z'] }).map((r) => r.id)).toEqual(['c']);
    expect(store.search({ tags: ['nope'] })).toEqual([]);
  });

  it('search by source filter', () => {
    const seeds = [makeBundled('b1', 'B1')];
    const store = createVaultStore<FooPayload>(TOOL_ID, seeds);
    store.add({ title: 'u1', tags: [], payload: { prompt: 'p' } });
    expect(store.search({ source: 'bundled' }).map((r) => r.id)).toEqual(['b1']);
    expect(store.search({ source: 'user' }).map((r) => r.title)).toEqual(['u1']);
  });

  it('togglePin on user item flips flag and persists', () => {
    const store = createVaultStore<FooPayload>(TOOL_ID, []);
    const u = store.add({ title: 'U', tags: [], payload: { prompt: 'p' } });
    expect(store.items.find((x) => x.id === u.id)!.pinned).toBeFalsy();

    store.togglePin(u.id);
    expect(store.items.find((x) => x.id === u.id)!.pinned).toBe(true);

    const raw = JSON.parse(localStorage.getItem(`cryptex.vault.${TOOL_ID}`)!);
    expect(raw[0].pinned).toBe(true);

    store.togglePin(u.id);
    expect(store.items.find((x) => x.id === u.id)!.pinned).toBe(false);
  });

  it('togglePin on bundled item uses pin-set side-table', () => {
    const seeds = [makeBundled('b1', 'B1')];
    const store = createVaultStore<FooPayload>(TOOL_ID, seeds);
    expect(store.items.find((x) => x.id === 'b1')!.pinned).toBeFalsy();

    store.togglePin('b1');
    expect(store.items.find((x) => x.id === 'b1')!.pinned).toBe(true);

    const raw = localStorage.getItem(`cryptex.vault.${TOOL_ID}.pinned`);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toContain('b1');

    store.togglePin('b1');
    expect(store.items.find((x) => x.id === 'b1')!.pinned).toBeFalsy();
  });

  it('allTags() returns sorted unique tag list', () => {
    const seeds = [
      makeBundled('a', 'A', ['zeta', 'alpha']),
      makeBundled('b', 'B', ['beta', 'alpha'])
    ];
    const store = createVaultStore<FooPayload>(TOOL_ID, seeds);
    store.add({ title: 'u', tags: ['custom'], payload: { prompt: 'p' } });
    expect(store.allTags()).toEqual(['alpha', 'beta', 'custom', 'zeta']);
  });

  it('count returns correct numbers across bundled + user', () => {
    const seeds = [makeBundled('b1', 'B1'), makeBundled('b2', 'B2')];
    const store = createVaultStore<FooPayload>(TOOL_ID, seeds);
    store.add({ title: 'u1', tags: [], payload: { prompt: 'p' } });
    store.add({ title: 'u2', tags: [], payload: { prompt: 'p' } });
    expect(store.count()).toEqual({ total: 4, bundled: 2, user: 2 });
  });

  it('re-instantiating store loads previously persisted items', () => {
    const store1 = createVaultStore<FooPayload>(TOOL_ID, []);
    store1.add({ title: 'Persistent', tags: ['t'], payload: { prompt: 'x' } });
    expect(store1.count().user).toBe(1);

    // New store instance reading the same tool key
    const store2 = createVaultStore<FooPayload>(TOOL_ID, []);
    expect(store2.count().user).toBe(1);
    expect(store2.items[0].title).toBe('Persistent');
  });

  it('search with combined text + tag + pinnedOnly works', () => {
    const seeds = [
      makeBundled('a', 'AlphaCat', ['fast', 'hot']),
      makeBundled('b', 'BetaCat', ['hot']),
      makeBundled('c', 'GammaDog', ['hot'])
    ];
    const store = createVaultStore<FooPayload>(TOOL_ID, seeds);
    store.togglePin('a');
    const res = store.search({ text: 'cat', tags: ['hot'], pinnedOnly: true });
    expect(res.map((r) => r.id)).toEqual(['a']);
  });
});
