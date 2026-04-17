/**
 * Module-level state for the Transform tool.
 *
 * Svelte 5 runes in `.svelte.ts` files + JS module singletons = state that
 * survives route-level remounts (tab switches) but resets on browser reload.
 * This is the privacy-first default picked for Cryptex: sensitive red-team
 * inputs are never written to disk.
 *
 * Pattern: one module-level `$state` per field, exposed via a getter/setter
 * object so the component can use `bind:value={transformState.input}`.
 */

export type Direction = 'encode' | 'decode';

let input = $state('');
let direction = $state<Direction>('encode');
let activeName = $state<string | null>(null);
let search = $state('');
let optionsForName = $state<string | null>(null);
let activeCategory = $state<string>('all');
// Tick counter so option-prefs changes re-run previews deterministically.
let optsTick = $state(0);

export const transformState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get direction() { return direction; },
  set direction(v: Direction) { direction = v; },

  get activeName() { return activeName; },
  set activeName(v: string | null) { activeName = v; },

  get search() { return search; },
  set search(v: string) { search = v; },

  get optionsForName() { return optionsForName; },
  set optionsForName(v: string | null) { optionsForName = v; },

  get activeCategory() { return activeCategory; },
  set activeCategory(v: string) { activeCategory = v; },

  get optsTick() { return optsTick; },
  bumpOpts() { optsTick++; },

  reset() {
    input = '';
    direction = 'encode';
    activeName = null;
    search = '';
    optionsForName = null;
    activeCategory = 'all';
    optsTick = 0;
  }
};
