/**
 * Module-level state for the Translate tool. Survives tab switches.
 * `activeLang`, `loading`, `error`, `addingLang`, `newLangName` stay component-local.
 */

let input = $state('');
let output = $state('');

export const translateState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get output() { return output; },
  set output(v: string) { output = v; },

  reset() {
    input = '';
    output = '';
  }
};
