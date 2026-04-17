/**
 * Module-level state for the Anti-Classifier tool. Survives tab switches.
 * Loading/error flags remain component-local.
 */

let input = $state('');
let output = $state('');
let maxTokens = $state(2000);

export const anticlassifierState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get output() { return output; },
  set output(v: string) { output = v; },

  get maxTokens() { return maxTokens; },
  set maxTokens(v: number) { maxTokens = v; },

  reset() {
    input = '';
    output = '';
    maxTokens = 2000;
  }
};
