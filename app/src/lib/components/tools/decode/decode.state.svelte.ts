/**
 * Module-level state for the Decode tool. Survives tab switches.
 */
let input = $state('');

export const decodeState = {
  get input() { return input; },
  set input(v: string) { input = v; },
  reset() { input = ''; }
};
